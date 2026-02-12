"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, Menu, Mic2, Music3, LayoutDashboard, Settings, Trash2, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/create/new", label: "Create Voice", icon: PlusSquare },
  { href: "/app/voices", label: "My Voices", icon: Mic2 },
  { href: "/app/generate", label: "Generate Song", icon: Music3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/voices/trash", label: "Trash", icon: Trash2 },
];

export function MobileNav() {
  const pathname = usePathname();

  const activeHref = React.useMemo(() => {
    const matches = nav.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    matches.sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href;
  }, [pathname]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 border-r border-white/10 bg-[linear-gradient(180deg,#070d24_0%,#060b1e_100%)] text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-left text-slate-100" style={{ fontFamily: "var(--font-heading)" }}>
            <span className="inline-flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-fuchsia-500">
                <AudioLines className="h-4 w-4 text-white" />
              </span>
              OG Voice
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 grid gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all",
                  active
                    ? "border-cyan-300/25 bg-gradient-to-r from-cyan-500/18 to-fuchsia-500/15 text-cyan-100"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <span className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-cyan-500/20 text-cyan-200" : "bg-white/[0.06]") }>
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
