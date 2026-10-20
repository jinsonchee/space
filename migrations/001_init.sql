-- Space v1 schema
create extension if not exists pgcrypto;

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  artist_name text not null,
  accent text not null default '#1ed760',
  logo text,            -- data URL (artist logo)
  photo text,           -- data URL (artist photo, used on loading screen)
  timezone text not null default 'Asia/Kuala_Lumpur',
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text,
  role_label text not null default 'Team',
  access text not null default 'member' check (access in ('master','admin','member')),
  pin_hash text not null,
  avatar jsonb not null default '{}'::jsonb,
  theme text not null default 'dark' check (theme in ('light','dark')),
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#8b5cf6'
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','doing','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_date date,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists task_assignees (
  task_id uuid references tasks(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  primary key (task_id, member_id)
);

create table if not exists task_labels (
  task_id uuid references tasks(id) on delete cascade,
  label_id uuid references labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, dedupe_key)
);
create index if not exists notifications_member_idx on notifications(member_id, created_at desc);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  scope text not null check (scope in ('day','week')),
  on_date date not null,  -- the day, or the Monday that starts the week
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists todos_member_idx on todos(member_id, scope, on_date);

create table if not exists stats_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  value bigint not null,
  captured_on date not null default current_date,
  source text not null default 'manual',
  unique (platform, captured_on)
);

create table if not exists login_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_idx on login_attempts(ip, at);
