"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic2, Music3, LayoutDashboard, Settings, Trash2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app/dashboard", label: "Create Voice", icon: LayoutDashboard },
  { href: "/app/voices", label: "AI Voices", icon: Mic2 },
  { href: "/app/voices/trash", label: "Trash", icon: Trash2 },
  { href: "/app/generate", label: "Generate", icon: Music3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  const activeHref = React.useMemo(() => {
    const matches = nav.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    matches.sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href;
  }, [pathname]);

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
      <div className="flex h-16 items-center px-5">
        <Link href="/app/dashboard" className="font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          OG Voice
        </Link>
      </div>
      <nav className="px-3">
        {nav.map((item) => {
          const active = activeHref === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 px-5">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs font-medium">Tip</div>
          <div className="mt-1 text-xs text-muted-foreground">Upload clean, noise-free audio for best results.</div>
        </div>
      </div>
    </aside>
  );
}
