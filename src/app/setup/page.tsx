import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import SetupClient from "./SetupClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from members`;
  if (n > 0) redirect("/login");
  return <SetupClient />;
}
