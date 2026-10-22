-- Daily Trends is retired: drop its data.
drop table if exists trend_items;
alter table settings drop column if exists trends_refreshed_at;
-- Content Report: keep each post's full caption/description and length, to explain its hook.
alter table posts add column if not exists caption text;
alter table posts add column if not exists duration_s int;
