-- Username + password account schema. Safe for a fresh project and migrates the
-- previous BetterChess email-based schema. Back up your project before upgrading.
create table if not exists public.accounts (
  username text primary key,
  salt text not null,
  hash text not null,
  created bigint not null default 0
);
create table if not exists public.sessions (
  token_hash text primary key,
  username text not null,
  exp bigint not null
);

-- Upgrade old accounts table: keep usernames and password hashes, discard email addresses.
alter table public.accounts drop constraint if exists accounts_pkey;
alter table public.accounts drop column if exists email;
alter table public.accounts alter column username set not null;
alter table public.accounts add constraint accounts_pkey primary key (username);
create unique index if not exists accounts_username_lower on public.accounts (lower(username));

-- Old sessions referenced email, so require users to sign in again after migration.
truncate table public.sessions;
alter table public.sessions drop column if exists email;
alter table public.sessions add column if not exists username text;
alter table public.sessions alter column username set not null;
alter table public.sessions alter column exp set not null;
create index if not exists sessions_exp on public.sessions (exp);

alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
