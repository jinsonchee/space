import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Encrypts secrets (Google tokens) before they go into the database.
// The key is derived from SESSION_SECRET, so no extra setting is needed. If SESSION_SECRET
// ever changes, stored tokens can't be read and people simply reconnect their calendar.
function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return Buffer.from(hkdfSync("sha256", s, "space", "google-calendar-tokens", 32));
}

/** Returns "v1.<iv>.<tag>.<ciphertext>" (base64url). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Returns null if the value can't be decrypted (e.g. SESSION_SECRET changed). */
export function decrypt(value: string): string | null {
  const [v, iv, tag, data] = value.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
