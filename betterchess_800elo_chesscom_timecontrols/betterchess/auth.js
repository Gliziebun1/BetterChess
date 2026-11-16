'use strict';
const crypto = require('crypto');
const store = require('./store');
const USER_SESSION = 30 * 24 * 3600 * 1000;
const GUEST_SESSION = 7 * 24 * 3600 * 1000;
let accounts = {}, sessions = {};
const ready = store.load().then(d => { accounts = d.accounts; sessions = d.sessions; console.log('Accounts: ' + Object.keys(accounts).length + ' loaded from ' + store.kind + ' storage'); });
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => crypto.scryptSync(pw, salt, 64);
const safeEq = (a,b) => {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const DUMMY_SALT=crypto.randomBytes(16).toString('hex');
const buckets=new Map();
function limited(k,max,ms){const now=Date.now();let b=buckets.get(k);if(!b||now>b.reset){b={n:0,reset:now+ms};buckets.set(k,b)}return ++b.n>max}
const ipOf=req=>String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim()||'ip';
const USERNAME_RE=/^[A-Za-z0-9_.-]{3,16}$/;
const RESERVED_RE=/^guest\d*$/i;
const norm=s=>s.toLowerCase();
const nameTaken=n=>!!accounts[norm(n)];
const reply=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
function readBody(req,res,cb){let body='',dead=false;req.on('data',d=>{body+=d;if(body.length>4096&&!dead){dead=true;reply(res,413,{error:'Request too large.'});req.destroy()}});req.on('end',()=>{if(dead)return;try{const o=JSON.parse(body||'{}');cb(o&&typeof o==='object'?o:null)}catch(e){cb(null)}})}
const str=(x,max=200)=>typeof x==='string'?x.slice(0,max):'';
const bearer=req=>(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
function newSession(info,ttl){const token=crypto.randomBytes(32).toString('hex'),h=sha(token),rec={...info,exp:Date.now()+ttl};sessions[h]=rec;if(rec.kind==='user'||store.persistGuests)store.saveSession(h,rec);return token}
function identify(token){if(typeof token!=='string'||token.length<32||token.length>128)return null;const s=sessions[sha(token)];if(!s||s.exp<Date.now())return null;if(s.kind==='user'){const a=accounts[s.username];return a?{name:a.username,guest:false,uid:'u:'+s.username}:null}return {name:s.name,guest:true,uid:'g:'+s.name}}
function activeGuestNames(){const now=Date.now(),set=new Set();for(const s of Object.values(sessions))if(s.kind==='guest'&&s.exp>now)set.add(s.name.toLowerCase());return set}
function makeGuestName(){const used=activeGuestNames();for(let i=0;i<200;i++){const n='Guest'+crypto.randomInt(100,10000);if(!used.has(n.toLowerCase()))return n}return null}
function handle(req,res,p){
 if(!p.startsWith('/api/auth/'))return false;
 const route=p.slice('/api/auth/'.length),ip=ipOf(req);
 if(req.method==='GET'&&route==='me'){const who=identify(bearer(req));if(!who){reply(res,401,{error:'Session expired'});return true}const s=sessions[sha(bearer(req))];if(s&&s.kind==='guest'){s.exp=Date.now()+GUEST_SESSION;if(store.persistGuests)store.saveSession(sha(bearer(req)),s)}reply(res,200,{name:who.name,guest:who.guest});return true}
 if(req.method!=='POST'){reply(res,405,{error:'Method not allowed'});return true}
 readBody(req,res,async b=>{try{await ready;if(!b)return reply(res,400,{error:'Bad request.'});
  if(route==='guest'){if(limited('guest:'+ip,30,3600000))return reply(res,429,{error:'Too many guest sessions. Try again later.'});const name=makeGuestName();if(!name)return reply(res,503,{error:'No guest names are free right now. Please try later.'});const token=newSession({kind:'guest',name},GUEST_SESSION);return reply(res,200,{name,token,guest:true})}
  if(route==='logout'){const tk=bearer(req);if(tk&&sessions[sha(tk)]){delete sessions[sha(tk)];store.deleteSession(sha(tk))}return reply(res,200,{ok:1})}
  if(route==='register'){if(limited('reg:'+ip,10,3600000))return reply(res,429,{error:'Too many attempts. Try again later.'});const username=str(b.username,40).trim(),password=str(b.password,200);if(!USERNAME_RE.test(username))return reply(res,400,{error:'Username must be 3–16 characters (letters, numbers, . _ -).'});if(RESERVED_RE.test(username))return reply(res,400,{error:'Usernames starting with "Guest" are reserved for guests.'});if(password.length<8||password.length>128)return reply(res,400,{error:'Password must be 8–128 characters.'});if(nameTaken(username))return reply(res,409,{error:'That username is already taken.'});const salt=crypto.randomBytes(16).toString('hex'),acc={username,salt,hash:scrypt(password,salt).toString('hex'),created:Date.now()};try{await store.saveAccount(norm(username),acc)}catch(e){if(e.code==='EXISTS')return reply(res,409,{error:'That username is already taken.'});console.error('Could not save account:',e.message);return reply(res,503,{error:'Could not save your account right now. Please try again.'})}accounts[norm(username)]=acc;const token=newSession({kind:'user',username:norm(username)},USER_SESSION);return reply(res,200,{name:username,token,guest:false,created:true})}
  if(route==='login'){const username=str(b.username||b.identifier,40).trim(),password=str(b.password,200),key=norm(username);if(!username||!password)return reply(res,400,{error:'Enter your username and password.'});if(limited('login-ip:'+ip,40,15*60000)||limited('login:'+key,10,15*60000))return reply(res,429,{error:'Too many sign-in attempts. Try again in a few minutes.'});const a=accounts[key],calc=scrypt(password,a?a.salt:DUMMY_SALT).toString('hex');if(!a||!safeEq(calc,a.hash))return reply(res,401,{error:'Incorrect username or password.'});const token=newSession({kind:'user',username:key},USER_SESSION);return reply(res,200,{name:a.username,token,guest:false})}
  reply(res,404,{error:'Not found'});
 }catch(e){console.error('auth error',e);if(!res.headersSent)reply(res,500,{error:'Something went wrong.'})}});
 return true;
}
setInterval(()=>{const now=Date.now();let changed=false;for(const[k,s]of Object.entries(sessions))if(s.exp<now){delete sessions[k];changed=true}if(changed)store.purgeExpired();for(const[k,b]of buckets)if(b.reset<now)buckets.delete(k)},60000).unref();
module.exports={handle,identify,ready};
