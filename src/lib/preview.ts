/** Attachment types the browser can preview safely inline (no HTML/SVG — those could run code). */
export const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);
