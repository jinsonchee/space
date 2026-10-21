-- Google connections can now include Gmail as well as Calendar.
-- `scopes` holds the permissions Google granted (space-separated), so each feature can be on or off.
alter table calendar_connections add column if not exists scopes text not null default '';
update calendar_connections set scopes = 'https://www.googleapis.com/auth/calendar.events.readonly' where scopes = '';
