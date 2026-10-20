import Link from "next/link";
import { I } from "@/components/Icons";

const ITEMS = [
  { href: "/inbox", label: "Inbox & Calendar", icon: "inbox", soon: true },
  { href: "/trends", label: "Daily Trends", icon: "trends", soon: true },
  { href: "/socials", label: "Post Stats", icon: "socials", soon: true },
  { href: "/profile", label: "My profile", icon: "user" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

export default function More() {
  return (
    <>
      <div className="page-head"><h1>More</h1></div>
      <div className="card" style={{ padding: 8 }}>
        {ITEMS.map((i) => {
          const Icon = I[i.icon];
          return (
            <Link key={i.href} href={i.href} className="nav-link" style={{ height: 52, color: "var(--text)" }}>
              <Icon />
              {i.label}
              {"soon" in i && i.soon ? <span className="nav-soon">SOON</span> : <I.right style={{ marginLeft: "auto", width: 16, color: "var(--faint)" }} />}
            </Link>
          );
        })}
      </div>
    </>
  );
}
