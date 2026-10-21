import { todayIn, timeIn } from "./dates";

/** "14:05" for today, "21 Oct" otherwise — in the Space's timezone. */
export function when(ms: number, tz: string) {
  const d = new Date(ms);
  if (todayIn(tz, d) === todayIn(tz)) return timeIn(tz, d);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: tz });
}

/** "Wed 21 Oct, 14:05" */
export function whenFull(ms: number, tz: string) {
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}, ${timeIn(tz, d)}`;
}
