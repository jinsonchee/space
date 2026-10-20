import "server-only";
import { sql, type AvatarConfig } from "./db";

export type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "done";
  priority: "low" | "normal" | "high";
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  assignees: string[];
  labels: string[];
  goal_id: string | null;
};
export type MemberLite = { id: string; name: string; avatar: AvatarConfig; photo: string | null; role_label: string };
export type Label = { id: string; name: string; color: string };

export async function getTasks(filter?: { assignee?: string; openOnly?: boolean }) {
  return sql<TaskRow[]>`
    select t.id, t.title, t.description, t.status, t.priority,
      to_char(t.due_date, 'YYYY-MM-DD') as due_date, t.goal_id, t.created_by, t.created_at, t.completed_at,
      coalesce((select json_agg(a.member_id) from task_assignees a where a.task_id = t.id), '[]') as assignees,
      coalesce((select json_agg(l.label_id) from task_labels l where l.task_id = t.id), '[]') as labels
    from tasks t
    where (${filter?.assignee ?? null}::uuid is null or exists (select 1 from task_assignees a where a.task_id = t.id and a.member_id = ${filter?.assignee ?? null}::uuid))
      and (${filter?.openOnly ?? false} = false or t.status <> 'done')
    order by (t.status = 'done'), t.due_date nulls last, t.created_at desc`;
}

export async function getMembersLite() {
  return sql<MemberLite[]>`select id, name, avatar, photo, role_label from members order by created_at`;
}

export async function getLabels() {
  return sql<Label[]>`select id, name, color from labels order by name`;
}

export type GoalLite = { id: string; title: string };
export async function getGoalsLite() {
  return sql<GoalLite[]>`select id, title from goals order by is_primary desc, end_date`;
}
