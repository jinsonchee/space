-- Tasks can now be put on hold (shown as ON-HOLD).
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check check (status in ('todo','doing','hold','done'));
