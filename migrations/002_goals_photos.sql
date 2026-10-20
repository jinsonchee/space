-- v1.1: real photos for people, yearly goals that tasks contribute to
alter table members add column if not exists photo text;
alter table settings alter column accent set default '#fa243c';

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'milestones' check (kind in ('milestones','metric')),
  platform text,                 -- for metric goals (spotify, instagram…)
  start_value bigint,
  target_value bigint,
  start_date date not null default current_date,
  end_date date not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tasks add column if not exists goal_id uuid references goals(id) on delete set null;
create index if not exists tasks_goal_idx on tasks(goal_id);
