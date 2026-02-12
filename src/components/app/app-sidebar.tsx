"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, Library, Mic2, Music3, LayoutDashboard, Settings, Trash2, PlusSquare } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, matchPath: "/app/dashboard" },
  { href: "/app/create/new", label: "Create Voice", icon: PlusSquare, matchPath: "/app/create" },
  { href: "/app/voices", label: "Clone Voice", icon: Mic2, matchPath: "/app/voices" },
  { href: "/app/generate", label: "Generate Song", icon: Music3, matchPath: "/app/generate" },
  { href: "/app/library", label: "My Library", icon: Library, matchPath: "/app/library" },
  { href: "/app/settings", label: "Settings", icon: Settings, matchPath: "/app/settings" },
  { href: "/app/voices/trash", label: "Trash", icon: Trash2, matchPath: "/app/voices/trash" },
];

export function AppSidebar() {
  const pathname = usePathname();

  const activeHref = React.useMemo(() => {
    const matches = nav.filter((item) => pathname === item.matchPath || pathname.startsWith(`${item.matchPath}/`));
    matches.sort((a, b) => b.matchPath.length - a.matchPath.length);
    return matches[0]?.href;
  }, [pathname]);

  return (
    <aside className="hidden min-h-dvh w-72 shrink-0 flex-col border-r border-white/10 bg-[linear-gradient(180deg,#070d24_0%,#060b1e_100%)] text-slate-200 md:flex">
      <div className="px-5 pb-4 pt-5">
        <Link href="/app/dashboard" className="inline-flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/90 to-fuchsia-500/85 shadow-[0_10px_30px_rgba(56,189,248,0.35)]">
            <AudioLines className="h-5 w-5 text-white" />
          </span>
          <span>
            <span className="block text-xl font-semibold leading-none text-white" style={{ fontFamily: "var(--font-heading)" }}>
              OG Voice
            </span>
            <span className="mt-1 block text-xs tracking-[0.2em] text-slate-400">STUDIO</span>
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col px-3 py-2">
        {nav.map((item) => {
          const active = activeHref === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1.5 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all",
                item.href === "/app/voices/trash" ? "mt-auto" : "",
                active
                  ? "border-cyan-300/25 bg-gradient-to-r from-cyan-500/18 to-fuchsia-500/15 text-cyan-100 shadow-[0_8px_24px_rgba(34,211,238,0.2)]"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg",
                  active ? "bg-cyan-500/20 text-cyan-200" : "bg-white/[0.06] text-slate-300"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
