import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;

/** Compare semver-ish strings: returns 1 if a > b, -1 if a < b, 0 if equal. */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export type UpdateInfo = { current: string; latest: string | null; available: boolean; notes?: string };

/**
 * Checks the publisher's version.json (hosted in the original Space repo).
 * Only the version number is fetched — nothing about this Space is sent.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const url = process.env.UPDATE_FEED_URL;
  if (!url) return { current: APP_VERSION, latest: null, available: false };
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const j = (await res.json()) as { version: string; notes?: string };
    return { current: APP_VERSION, latest: j.version, available: compareVersions(j.version, APP_VERSION) > 0, notes: j.notes };
  } catch {
    return { current: APP_VERSION, latest: null, available: false };
  }
}
