"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, BarChart3, SlidersHorizontal, Sparkles, SendHorizontal } from "lucide-react";

const NAV_LINKS = [
  { href: "/",          label: "Companies", icon: Building2 },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/settings",  label: "Settings",  icon: SlidersHorizontal },
];

export function Navbar({ isMock }: { isMock: boolean }) {
  const pathname = usePathname();

  return (
    <header className="b-navbar sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 b-nav-logo">
          <div className="b-logo-icon">
            <SendHorizontal className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Outreach Assistant
          </span>
          <span className="b-mono b-pro-tag">pro</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {isMock ? (
            <span className="b-badge b-badge-warning mr-3">
              <span className="b-dot b-dot-warning b-pulse" />
              Mock
            </span>
          ) : (
            <span className="b-badge b-badge-success mr-3">
              <span className="b-dot b-dot-success b-pulse" />
              Live
            </span>
          )}

          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`b-nav-link ${active ? "b-nav-link-active" : ""}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          <Link href="/" className="b-btn b-btn-primary ml-2" style={{ padding: "5px 12px", fontSize: "12px" }}>
            <Sparkles className="w-3 h-3" />
            New
          </Link>
        </nav>
      </div>
    </header>
  );
}
