"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { SPRING_FAST } from "@/lib/motion";
import { I } from "./Icons";
import { SpaceIcon } from "./Logo";
import { Photo, ArtistLogo } from "./Photo";

type NavItem = { href: string; label: string; icon: keyof typeof I; soon?: boolean; adminOnly?: boolean };
export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/week", label: "My Week", icon: "week" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/trends", label: "Trends", icon: "trends" },
  { href: "/socials", label: "Post Stats", icon: "socials" },
];
const NAV2: NavItem[] = [
  { href: "/team", label: "Team", icon: "team" },
  { href: "/settings", label: "Settings", icon: "settings", adminOnly: true }, // whole-Space settings: artist + admins
];
const TABS: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/week", label: "Week", icon: "week" },
  { href: "/team", label: "Team", icon: "team" },
  { href: "/more", label: "More", icon: "more" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Shell({ artist, logo, me, isAdmin, children }: { artist: string; logo: string | null; me: { name: string; role_label: string; photo: string | null }; isAdmin: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const Brand = (
    <Link href="/" className="brand-mark" aria-label={`${artist}'s Space`}>
      <SpaceIcon style={{ width: 26, height: 26, color: "var(--accent)" }} />
      <span className="divider-v" />
      <ArtistLogo src={logo} name={artist} height={38} />
    </Link>
  );
  const link = (n: NavItem) => {
    const Icon = I[n.icon];
    const on = active(path, n.href);
    return (
      <Link key={n.href} href={n.href} className="nav-link" aria-current={on ? "page" : undefined}>
        {on && <motion.span layoutId="nav-pill" className="nav-pill" transition={SPRING_FAST} />}
        <Icon />
        {n.label}
        {n.soon && <span className="nav-soon">SOON</span>}
      </Link>
    );
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">{Brand}</div>
        {NAV.map(link)}
        <div className="nav-sep" />
        {NAV2.filter((n) => !n.adminOnly || isAdmin).map(link)}
        <div className="sidebar-foot">
          <Link href="/profile" className="me-card">
            <Photo src={me.photo} name={me.name} size={36} />
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{me.name}</div>
              <div className="tiny muted">{me.role_label}</div>
            </div>
            <I.user style={{ width: 18, height: 18, color: "var(--faint)" }} />
          </Link>
        </div>
      </aside>

      <header className="topbar">
        {Brand}
        <Link href="/profile" aria-label="Your profile"><Photo src={me.photo} name={me.name} size={34} /></Link>
      </header>

      <main className="main">{children}</main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map((n) => {
          const Icon = I[n.icon];
          const on = n.href === "/more" ? ["/more", "/inbox", "/trends", "/socials", "/settings", "/profile"].some((p) => path.startsWith(p)) : active(path, n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}>
              {on && <motion.span layoutId="tab-pill" className="tab-pill" transition={SPRING_FAST} />}
              <Icon />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
