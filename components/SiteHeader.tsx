"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const links = [
  { href: "/", label: "Explore roles" },
  { href: "/compare", label: "Compare players" },
  { href: "/play-lab", label: "Play Lab" },
  { href: "/methodology", label: "Methodology" },
];

const THEME_KEY = "nba-theme";
const THEME_CHANGE = "nba-theme-change";

function getTheme(): "light" | "dark" {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener(THEME_CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export default function SiteHeader() {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, () => "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = getTheme();
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Allow switching for this page even if preferences cannot be saved.
    }
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(THEME_CHANGE));
  }

  const activeHref = pathname.startsWith("/players/") ? "/" : pathname;

  const navLinks = links.map(({ href, label }) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={`nav-link ${activeHref === href ? "nav-link-active" : ""}`}
    >
      {label}
    </Link>
  ));

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">NBA <span className="text-amber">Archetypes</span></Link>
        <nav className="site-nav" aria-label="Main navigation">{navLinks}</nav>
        <div className="site-header-actions">
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
          </button>
          <details
            className="site-menu"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a")) event.currentTarget.open = false;
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary>Menu</summary>
            <nav aria-label="Main navigation">{navLinks}</nav>
          </details>
        </div>
      </div>
    </header>
  );
}
