-- Daily Trends: each morning's top YouTube videos per hashtag, and the Music chart per country.
create table if not exists trend_items (
  day date not null,
  source text not null,          -- 'tag:singersongwriter' | 'chart:SG' …
  rank int not null,
  video_id text not null,
  title text not null default '',
  channel text not null default '',
  thumbnail text,
  views bigint,
  published_at timestamptz,
  primary key (day, source, rank)
);
alter table settings add column if not exists trends_refreshed_at timestamptz;
