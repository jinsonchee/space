-- Post Stats: every post (YouTube videos first) and a daily snapshot of its numbers, for growth.
create table if not exists posts (
  platform text not null,
  post_id text not null,
  title text not null default '',
  url text,
  thumbnail text,
  kind text not null default 'video',   -- video | short | reel | photo …
  published_at timestamptz,
  primary key (platform, post_id)
);
create table if not exists post_snapshots (
  platform text not null,
  post_id text not null,
  captured_on date not null,
  views bigint, likes bigint, comments bigint, shares bigint, saves bigint,
  primary key (platform, post_id, captured_on)
);
create index if not exists post_snapshots_day_idx on post_snapshots (captured_on);
