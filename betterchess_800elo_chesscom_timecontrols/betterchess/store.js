'use strict';
// Where username-based accounts and sessions are kept. No dependencies.
//   - Default: JSON files in DATA_DIR (fine locally; lost on hosts with a temporary disk).
//   - Supabase: set SUPABASE_URL and SUPABASE_SERVICE_KEY and everything is saved in a free hosted Postgres,
//     so accounts survive Render's free-tier restarts and redeploys. Run supabase.sql once to create the tables.
const fs = require('fs');
const path = require('path');

function fileStore() {
  const DATA_DIR = process.env.DATA_DIR || __dirname;
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
  const AF = path.join(DATA_DIR, 'accounts.json'), SF = path.join(DATA_DIR, 'sessions.json');
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const wr = (f, o) => { try { fs.writeFileSync(f + '.tmp', JSON.stringify(o), { mode: 0o600 }); fs.renameSync(f + '.tmp', f); } catch (e) { console.error('Could not save ' + path.basename(f) + ': ' + e.message); } };
  let accounts = {}, sessions = {}, timer = null;
  const flushSessions = () => { if (timer) return; timer = setTimeout(() => { timer = null; wr(SF, sessions); }, 500); };
  return {
    kind: 'file', persistGuests: true,
    async load() {
      const rawAccounts = rd(AF, {}), rawSessions = rd(SF, {});
      accounts = {};
      for (const a of Object.values(rawAccounts)) if (a && a.username) accounts[a.username.toLowerCase()] = a;
      sessions = {};
      for (const [h, s] of Object.entries(rawSessions)) {
        if (s && s.kind === 'user') { const old = rawAccounts[s.email]; const username = s.username || (old && old.username); if (username) sessions[h] = { kind: 'user', username: username.toLowerCase(), exp: s.exp }; }
        else if (s) sessions[h] = s;
      }
      wr(AF, accounts); wr(SF, sessions);
      return { accounts, sessions };
    },
    async saveAccount(username, acc) { accounts[username] = acc; wr(AF, accounts); },
    saveSession(hash, s) { sessions[hash] = s; flushSessions(); },
    deleteSession(hash) { delete sessions[hash]; flushSessions(); },
    purgeExpired() { flushSessions(); }
  };
}

function supabaseStore() {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';
  const key = process.env.SUPABASE_SERVICE_KEY;
  const headers = (extra) => {
    const h = { apikey: key, 'Content-Type': 'application/json', ...extra };
    if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key; // legacy JWT-style keys; new sb_secret_ keys use apikey only
    return h;
  };
  async function call(method, pathAndQuery, body, extra) {
    const r = await fetch(base + pathAndQuery, { method, headers: headers(extra), body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      const e = new Error('Supabase ' + method + ' ' + pathAndQuery.split('?')[0] + ' -> ' + r.status + ' ' + txt.slice(0, 200));
      if (r.status === 409 || /23505|duplicate key/i.test(txt)) e.code = 'EXISTS';
      throw e;
    }
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  async function all(table, order) {
    const rows = []; const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const part = await call('GET', '/' + table + '?select=*&order=' + order + '&limit=' + PAGE + '&offset=' + off);
      rows.push(...part);
      if (part.length < PAGE) return rows;
    }
  }
  return {
    kind: 'supabase', persistGuests: false, // guests are short-lived: kept in memory only
    async load() {
      await this.purgeExpired();
      const accounts = {}, sessions = {};
      for (const r of await all('accounts', 'username.asc')) accounts[r.username.toLowerCase()] = { username: r.username, salt: r.salt, hash: r.hash, created: Number(r.created) || 0 };
      for (const r of await all('sessions', 'token_hash.asc')) sessions[r.token_hash] = { kind: 'user', username: r.username.toLowerCase(), exp: Number(r.exp) };
      return { accounts, sessions };
    },
    async saveAccount(username, a) {
      await call('POST', '/accounts', { username: a.username, salt: a.salt, hash: a.hash, created: a.created || Date.now() }, { Prefer: 'return=minimal' });
    },
    saveSession(hash, s) {
      if (s.kind !== 'user') return;
      call('POST', '/sessions?on_conflict=token_hash', { token_hash: hash, username: s.username, exp: s.exp }, { Prefer: 'resolution=merge-duplicates,return=minimal' })
        .catch(e => console.error('Could not save session:', e.message));
    },
    deleteSession(hash) {
      call('DELETE', '/sessions?token_hash=eq.' + encodeURIComponent(hash)).catch(e => console.error('Could not delete session:', e.message));
    },
    async purgeExpired() {
      try { await call('DELETE', '/sessions?exp=lt.' + Date.now()); } catch (e) { if (this.kind) console.error('Could not purge sessions:', e.message); }
    }
  };
}

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
module.exports = useSupabase ? supabaseStore() : fileStore();
