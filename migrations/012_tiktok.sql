-- TikTok (Login Kit + Display API scopes): the connected account, with its tokens encrypted.
alter table settings add column if not exists tiktok jsonb; -- { open_id, username, token, refresh, expires_at, refresh_expires_at, status, followers, likes, video_count, synced_at, connected_at }
