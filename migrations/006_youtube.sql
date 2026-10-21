-- YouTube channel for automatic daily stats (public numbers via the YouTube Data API).
alter table settings add column if not exists youtube_handle text;
alter table settings add column if not exists youtube_channel jsonb; -- { id, title, subscribers, views, videos, hidden, synced_at }
