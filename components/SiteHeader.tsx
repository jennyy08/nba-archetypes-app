"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Explore roles" },
  { href: "/compare", label: "Compare players" },
  { href: "/play-lab", label: "Play Lab" },
  { href: "/profile-lab", label: "Profile Lab" },
  { href: "/methodology", label: "Methodology" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">(() => typeof window !== "undefined" && localStorage.getItem("nba-theme") === "light" ? "light" : "dark");
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("nba-theme", theme); }, [theme]);
  return <header className="sticky top-0 z-20 border-b border-court-border bg-court-bg/95 backdrop-blur px-6 md:px-8">
    <div className="max-w-[1600px] mx-auto h-16 flex items-center justify-between gap-5">
      <Link href="/" className="font-display uppercase tracking-wide text-text text-lg shrink-0">NBA <span className="text-amber">Archetypes</span></Link>
      <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Main navigation">
        {links.map((link) => <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href ? "nav-link-active" : ""}`}>{link.label}</Link>)}
      </nav>
      <button onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} className="theme-toggle" aria-label="Toggle light mode">{theme === "dark" ? "☀" : "◐"}</button>
    </div>
  </header>;
}
