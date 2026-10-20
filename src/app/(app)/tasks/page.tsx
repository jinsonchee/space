import { requireMember, atLeast } from "@/lib/auth";
import { getTasks, getMembersLite, getLabels, getGoalsLite } from "@/lib/queries";
import { getSettings } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import TasksClient from "./TasksClient";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const me = await requireMember();
  const [tasks, members, labels, goals, s, sp] = await Promise.all([getTasks(), getMembersLite(), getLabels(), getGoalsLite(), getSettings(), searchParams]);
  return (
    <TasksClient
      tasks={JSON.parse(JSON.stringify(tasks))}
      members={members}
      labels={labels}
      goals={goals}
      meId={me.id}
      isAdmin={atLeast(me, "admin")}
      today={todayIn(s!.timezone)}
      openId={sp.open ?? null}
    />
  );
}
