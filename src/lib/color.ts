export function isHex(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

/** Picks black or white text for a given accent colour. */
export function inkFor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.36 ? "#0b0b0d" : "#ffffff";
}

export const ACCENTS = ["#fa243c", "#1ed760", "#ff4fa3", "#8b5cf6", "#3b82f6", "#22d3ee", "#ffb020", "#ff6a3d", "#f43f5e", "#a3e635", "#f5f5f7"];
