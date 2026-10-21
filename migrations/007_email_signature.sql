-- Each person's email signature, added to emails they write in Space.
alter table members add column if not exists email_signature text not null default '';
