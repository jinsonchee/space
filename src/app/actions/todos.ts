"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { isIsoDate, mondayOf, addDays } from "@/lib/dates";

const uuidRe = /^[0-9a-f-]{36}$/i;

export async function addTodo(scope: "day" | "week", date: string, text: string) {
  const me = await requireMember();
  const t = text.trim().slice(0, 300);
  if (!t || !isIsoDate(date) || !["day", "week"].includes(scope)) return;
  const on = scope === "week" ? mondayOf(date) : date;
  await sql`insert into todos (member_id, scope, on_date, text) values (${me.id}, ${scope}, ${on}, ${t})`;
  revalidatePath("/week");
  revalidatePath("/");
}

export async function toggleTodo(id: string) {
  const me = await requireMember();
  if (!uuidRe.test(id)) return;
  await sql`update todos set done = not done where id = ${id} and member_id = ${me.id}`;
  revalidatePath("/week");
  revalidatePath("/");
}

export async function deleteTodo(id: string) {
  const me = await requireMember();
  if (!uuidRe.test(id)) return;
  await sql`delete from todos where id = ${id} and member_id = ${me.id}`;
  revalidatePath("/week");
}

/** Copies unfinished weekly goals from one week into the next. */
export async function renewWeek(fromMonday: string) {
  const me = await requireMember();
  if (!isIsoDate(fromMonday)) return 0;
  const to = addDays(mondayOf(fromMonday), 7);
  const rows = await sql`
    insert into todos (member_id, scope, on_date, text)
    select member_id, 'week', ${to}, text from todos
    where member_id = ${me.id} and scope = 'week' and on_date = ${mondayOf(fromMonday)} and not done
      and text not in (select text from todos where member_id = ${me.id} and scope = 'week' and on_date = ${to})
    returning id`;
  revalidatePath("/week");
  return rows.length;
}

/** Moves unfinished items from one day to another (e.g. yesterday → today). */
export async function carryOver(fromDay: string, toDay: string) {
  const me = await requireMember();
  if (!isIsoDate(fromDay) || !isIsoDate(toDay)) return 0;
  const rows = await sql`
    update todos set on_date = ${toDay}
    where member_id = ${me.id} and scope = 'day' and on_date = ${fromDay} and not done
    returning id`;
  revalidatePath("/week");
  return rows.length;
}
