// Task statuses and priorities: stored values, the names people see, and their colours.
// Colours live in globals.css (.tag-*) so they can differ between light and dark themes.

export type TaskStatus = "todo" | "doing" | "hold" | "done";
export type TaskPriority = "low" | "normal" | "high";

export const STATUSES: { key: TaskStatus; label: string; emoji: string }[] = [
  { key: "todo", label: "IN-QUEUE", emoji: "📝" },
  { key: "doing", label: "IN-PROGRESS", emoji: "🎧" },
  { key: "hold", label: "ON-HOLD", emoji: "⏸️" },
  { key: "done", label: "COMPLETE", emoji: "✅" },
];

export const PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: "low", label: "LOW" },
  { key: "normal", label: "NORMAL" },
  { key: "high", label: "URGENT" },
];

export const statusLabel = (s: TaskStatus) => STATUSES.find((x) => x.key === s)?.label ?? s;
export const priorityLabel = (p: TaskPriority) => PRIORITIES.find((x) => x.key === p)?.label ?? p;
