-- Each person chooses which notifications they get, and how (the dove in Space and/or email).
alter table members add column if not exists notify_prefs jsonb not null default '{}'::jsonb;
-- Notifications someone turned off for the dove are still recorded (so they aren't re-sent) but stay hidden.
alter table notifications add column if not exists hidden boolean not null default false;
