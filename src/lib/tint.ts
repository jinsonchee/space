// A steady colour per person, so the same sender always gets the same initial badge.
const TINTS = ["#5e8bff", "#e5739a", "#3fb58a", "#d9963b", "#9a7af0", "#4bb3c9", "#e0675a"];
export const tint = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
export const initial = (name: string) => (name.replace(/["'<]/g, "").trim()[0] ?? "?").toUpperCase();
