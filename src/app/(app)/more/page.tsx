import Link from "next/link";
import { I } from "@/components/Icons";
import { requireMember, atLeast } from "@/lib/auth";

const ITEMS = [
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/trends", label: "Daily Trends", icon: "trends" },
  { href: "/socials", label: "Post Stats", icon: "socials" },
  { href: "/profile", label: "My profile", icon: "user" },
  { href: "/settings", label: "Settings", icon: "settings", adminOnly: true },
] as const;

export default async function More() {
  const me = await requireMember();
  const isAdmin = atLeast(me, "admin");
  return (
    <>
      <div className="page-head"><h1>More</h1></div>
      <div className="card" style={{ padding: 8 }}>
        {ITEMS.filter((i) => !("adminOnly" in i) || isAdmin).map((i) => {
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
