import { requireMember } from "@/lib/auth";
import { sql, type Access } from "@/lib/db";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const me = await requireMember();
  const members = await sql<{ id: string; name: string; email: string | null; phone: string | null; role_label: string; access: Access; photo: string | null; open: number }[]>`
    select m.id, m.name, m.email, m.phone, m.role_label, m.access, m.photo,
      (select count(*)::int from task_assignees a join tasks t on t.id = a.task_id where a.member_id = m.id and t.status <> 'done') as open
    from members m
    order by case m.access when 'master' then 0 when 'admin' then 1 else 2 end, m.created_at`;
  return <TeamClient members={members} viewer={{ id: me.id, access: me.access }} />;
}
