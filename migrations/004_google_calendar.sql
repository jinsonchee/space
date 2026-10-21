-- Google Calendar connections (read-only, main calendar).
-- Tokens are encrypted by the app (AES-256-GCM, see src/lib/crypto.ts) before they are stored.
create table if not exists calendar_connections (
  member_id uuid primary key references members(id) on delete cascade,
  google_email text,
  refresh_token text not null,
  access_token text,
  access_expires_at timestamptz,
  status text not null default 'ok' check (status in ('ok', 'expired')),
  connected_at timestamptz not null default now()
);
