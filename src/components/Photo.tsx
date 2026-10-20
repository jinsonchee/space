/* eslint-disable @next/next/no-img-element */

/** A person's real photo (round). Falls back to initials on the accent colour. */
export function Photo({ src, name, size = 32, ring = false }: { src?: string | null; name: string; size?: number; ring?: boolean }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={`photo ${ring ? "photo-ring" : ""}`} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }} title={name}>
      {src ? <img src={src} alt={name} /> : <span>{initials}</span>}
    </span>
  );
}

/** The artist's logo (SVG/PNG). Inverts automatically on light theme since the mark is white. */
export function ArtistLogo({ src, name, height = 28, className }: { src?: string | null; name: string; height?: number; className?: string }) {
  if (!src) return <span className={`head ${className ?? ""}`} style={{ fontSize: height * 0.7, fontWeight: 700 }}>{name}</span>;
  return <img src={src} alt={name} className={`artist-logo ${className ?? ""}`} style={{ height, width: "auto" }} />;
}
