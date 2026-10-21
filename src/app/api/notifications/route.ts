import { NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await sql`
    select id, kind, title, body, link, read_at, created_at from notifications
    where member_id = ${me.id} and not hidden order by created_at desc limit 25`;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where member_id = ${me.id} and read_at is null and not hidden`;
  return NextResponse.json({ items, unread: n });
}

export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  if (Array.isArray(body.ids) && body.ids.length) {
    await sql`update notifications set read_at = now() where member_id = ${me.id} and id = any(${body.ids}::uuid[]) and read_at is null`;
  } else {
    await sql`update notifications set read_at = now() where member_id = ${me.id} and read_at is null`;
  }
  return NextResponse.json({ ok: true });
}
