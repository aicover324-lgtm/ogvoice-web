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

export function AppSidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  const activeHref = React.useMemo(() => {
    const matches = nav.filter((item) => pathname === item.matchPath || pathname.startsWith(`${item.matchPath}/`));
    matches.sort((a, b) => b.matchPath.length - a.matchPath.length);
    return matches[0]?.href;
  }, [pathname]);

  const displayName = userName?.trim() || "Creator";
  const shortName = initials(displayName);

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

      <nav className="px-3 py-2">
        {nav.map((item) => {
          const active = activeHref === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1.5 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all",
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

      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cyan-500/35 to-fuchsia-500/35 text-sm font-semibold text-white">
              {shortName}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{displayName}</div>
              <div className="text-xs text-slate-400">Creator Plan</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>Storage</span>
              <span>6.2 / 10 GB</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400" style={{ width: "62%" }} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function initials(name: string) {
  const chunks = name.split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return "OG";
  if (chunks.length === 1) return chunks[0]!.slice(0, 2).toUpperCase();
  return `${chunks[0]![0] || ""}${chunks[1]![0] || ""}`.toUpperCase();
}
