// Notification types people can switch on/off, per channel. Defaults = how Space behaved before.
export type NotifyChannel = "app" | "email";
export type NotifyPrefs = Partial<Record<string, Partial<Record<NotifyChannel, boolean>>>>;

export const NOTIFY_KINDS = [
  { kind: "assigned", name: "A task is assigned to you", app: true, email: true },
  { kind: "nudge", name: "A teammate nudges you about a task", app: true, email: true, note: "Email only when they choose “App + email”." },
  { kind: "done", name: "Someone finishes a task you created", app: true, email: false },
  { kind: "due", name: "Tasks due today or overdue (each morning)", app: true, email: false },
  { kind: "monday", name: "Monday “here’s your week” overview", app: true, email: true },
  { kind: "sunday", name: "Sunday “plan next week” reminder", app: true, email: true },
] as const;

export function wants(prefs: NotifyPrefs | null | undefined, kind: string, channel: NotifyChannel) {
  const def = NOTIFY_KINDS.find((k) => k.kind === kind);
  if (!def) return true; // e.g. "reconnect Google" — always on
  return prefs?.[kind]?.[channel] ?? def[channel];
}
