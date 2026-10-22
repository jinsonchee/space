"use server";
import { revalidatePath } from "next/cache";
import { sql, transaction, getSettings } from "@/lib/db";
import { requireMember, atLeast } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isIsoDate, todayIn } from "@/lib/dates";
import { isHex } from "@/lib/color";
import type { TaskStatus, TaskPriority } from "@/lib/task-meta";

export type TaskInput = {
  id?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assignees?: string[];
  labels?: string[];
  goal_id?: string | null;
};

const STATUSES: readonly TaskStatus[] = ["todo", "doing", "hold", "done"];
const PRIOS: readonly TaskPriority[] = ["low", "normal", "high"];
const uuidRe = /^[0-9a-f-]{36}$/i;
const ids = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string" && uuidRe.test(x)) : []);

export async function saveTask(input: TaskInput) {
  const me = await requireMember();
  const title = (input.title ?? "").trim().slice(0, 200);
  if (!title) return { ok: false as const, error: "Give the task a title." };
  const status = STATUSES.includes(input.status as never) ? input.status! : "todo";
  const priority = PRIOS.includes(input.priority as never) ? input.priority! : "normal";
  const due = isIsoDate(input.due_date) ? input.due_date : null;
  const description = (input.description ?? "").slice(0, 5000);
  const assignees = ids(input.assignees);
  const labels = ids(input.labels);
  const goalId = input.goal_id && uuidRe.test(input.goal_id) ? input.goal_id : null;

  let taskId = input.id && uuidRe.test(input.id) ? input.id : null;
  let previous: string[] = [];
  await transaction(async (tx) => {
    if (taskId) {
      previous = (await tx<{ member_id: string }[]>`select member_id from task_assignees where task_id = ${taskId}`).map((r) => r.member_id);
      await tx`
        update tasks set title = ${title}, description = ${description}, status = ${status}, priority = ${priority},
          due_date = ${due}, goal_id = ${goalId}, updated_at = now(),
          completed_at = case when ${status} = 'done' then coalesce(completed_at, now()) else null end
        where id = ${taskId}`;
      await tx`delete from task_assignees where task_id = ${taskId}`;
      await tx`delete from task_labels where task_id = ${taskId}`;
    } else {
      const [t] = await tx<{ id: string }[]>`
        insert into tasks (title, description, status, priority, due_date, goal_id, created_by, completed_at)
        values (${title}, ${description}, ${status}, ${priority}, ${due}, ${goalId}, ${me.id}, ${status === "done" ? new Date() : null})
        returning id`;
      taskId = t.id;
    }
    for (const a of assignees) await tx`insert into task_assignees (task_id, member_id) values (${taskId}, ${a}) on conflict do nothing`;
    for (const l of labels) await tx`insert into task_labels (task_id, label_id) values (${taskId}, ${l}) on conflict do nothing`;
  });

  // Tell newly assigned teammates (in-app + email).
  for (const a of assignees.filter((x) => !previous.includes(x) && x !== me.id)) {
    await notify({
      memberId: a,
      kind: "assigned",
      title: `${me.name.split(" ")[0]} assigned you a task`,
      body: `“${title}”${due ? `\nDue ${due}` : ""}`,
      link: `/tasks?open=${taskId}`,
      email: true,
    });
  }
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true as const, id: taskId! };
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const me = await requireMember();
  if (!uuidRe.test(id) || !STATUSES.includes(status)) return;
  const [t] = await sql<{ title: string; created_by: string | null; status: string }[]>`select title, created_by, status from tasks where id = ${id}`;
  if (!t) return;
  await sql`
    update tasks set status = ${status}, updated_at = now(),
      completed_at = case when ${status} = 'done' then coalesce(completed_at, now()) else null end
    where id = ${id}`;
  if (status === "done" && t.status !== "done" && t.created_by && t.created_by !== me.id) {
    await notify({ memberId: t.created_by, kind: "done", title: `${me.name.split(" ")[0]} finished a task 🎉`, body: `“${t.title}”`, link: `/tasks?open=${id}` });
  }
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const me = await requireMember();
  if (!uuidRe.test(id)) return { ok: false as const, error: "Bad task" };
  const [t] = await sql<{ created_by: string | null }[]>`select created_by from tasks where id = ${id}`;
  if (!t) return { ok: true as const };
  if (t.created_by !== me.id && !atLeast(me, "admin")) return { ok: false as const, error: "Only the creator or an admin can delete this task." };
  await sql`delete from tasks where id = ${id}`;
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true as const };
}

/** Sends a reminder to everyone assigned to an unfinished task. Limited to once every 6 hours per person. */
export async function nudgeTask(id: string, channel: "app" | "email" | "both" = "both") {
  const me = await requireMember();
  if (!uuidRe.test(id)) return { ok: false as const, error: "Bad task" };
  const [t] = await sql<{ title: string; status: string; due_date: string | null }[]>`
    select title, status, to_char(due_date, 'YYYY-MM-DD') as due_date from tasks where id = ${id}`;
  if (!t) return { ok: false as const, error: "Task not found" };
  if (t.status === "done") return { ok: false as const, error: "That task is already done!" };
  const people = (await sql<{ member_id: string }[]>`select member_id from task_assignees where task_id = ${id}`).map((r) => r.member_id).filter((m) => m !== me.id);
  if (!people.length) return { ok: false as const, error: "Nobody else is assigned to this task yet." };
  const window = Math.floor(Date.now() / (6 * 3600 * 1000));
  let sent = 0;
  for (const p of people) {
    const ok = await notify({
      memberId: p,
      kind: "nudge",
      title: `Friendly nudge from ${me.name.split(" ")[0]} 👋`,
      body: `“${t.title}” is still open${t.due_date ? ` (due ${t.due_date})` : ""}. Can you close it off?`,
      link: `/tasks?open=${id}`,
      dedupeKey: `nudge:${id}:${window}`,
      email: channel !== "app",
    });
    if (ok) sent++;
  }
  if (!sent) return { ok: false as const, error: "Already nudged recently — give them a few hours." };
  return { ok: true as const, sent };
}

/** One reminder to a teammate about everything of theirs that's overdue (Home → Team status). */
export async function nudgeMember(memberId: string) {
  const me = await requireMember();
  if (!uuidRe.test(memberId)) return { ok: false as const, error: "Bad member" };
  if (memberId === me.id) return { ok: false as const, error: "That's you!" };
  const today = todayIn((await getSettings())!.timezone);
  const late = await sql<{ title: string }[]>`
    select t.title from tasks t join task_assignees a on a.task_id = t.id
    where a.member_id = ${memberId} and t.status <> 'done' and t.due_date < ${today}
    order by t.due_date limit 5`;
  if (!late.length) return { ok: false as const, error: "Nothing of theirs is overdue." };
  const window = Math.floor(Date.now() / (6 * 3600 * 1000));
  const ok = await notify({
    memberId,
    kind: "nudge",
    title: `Friendly nudge from ${me.name.split(" ")[0]} 👋`,
    body: `${late.length === 1 ? "This is" : "These are"} past due:\n${late.map((t) => `• ${t.title}`).join("\n")}`,
    link: "/tasks",
    dedupeKey: `nudge-member:${memberId}:${window}`,
    email: true,
  });
  if (!ok) return { ok: false as const, error: "Already nudged recently. Give them a few hours." };
  return { ok: true as const };
}

export async function createLabel(name: string, color: string) {
  await requireMember();
  const n = name.trim().slice(0, 30);
  if (!n) return { ok: false as const, error: "Name the label." };
  const [l] = await sql<{ id: string; name: string; color: string }[]>`
    insert into labels (name, color) values (${n}, ${isHex(color) ? color : "#8b5cf6"})
    on conflict (name) do update set name = excluded.name returning id, name, color`;
  revalidatePath("/tasks");
  return { ok: true as const, label: l };
}

export async function deleteLabel(id: string) {
  await requireMember();
  if (!uuidRe.test(id)) return;
  await sql`delete from labels where id = ${id}`;
  revalidatePath("/tasks");
}
