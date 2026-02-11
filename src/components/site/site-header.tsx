import Link from "next/link";
import { Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b18]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 text-white">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-fuchsia-500 shadow-[0_4px_16px_rgba(6,182,212,0.4)]">
              <Mic2 className="h-4 w-4 text-white" />
            </span>
            OG Voice
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <Link href="/#features" className="transition-colors hover:text-cyan-200">Features</Link>
            <Link href="/#how-it-works" className="transition-colors hover:text-cyan-200">How It Works</Link>
            <Link href="/pricing" className="transition-colors hover:text-cyan-200">Pricing</Link>
            <Link href="/faq" className="transition-colors hover:text-cyan-200">FAQ</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="og-btn-outline-soft hidden h-10 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button
            asChild
            className="og-btn-gradient h-10 rounded-xl px-5"
          >
            <Link href="/register">Start Free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
