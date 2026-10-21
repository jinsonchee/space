-- Instagram (Instagram API with Instagram Login): the connected account, with its token encrypted.
alter table settings add column if not exists instagram jsonb; -- { user_id, username, token (encrypted), expires_at, status, followers, media_count, synced_at }
-- Instagram also reports how many people a post reached.
alter table post_snapshots add column if not exists reach bigint;
