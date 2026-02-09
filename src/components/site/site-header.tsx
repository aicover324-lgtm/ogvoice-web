import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            OG Voice
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/faq" className="hover:text-foreground">FAQ</Link>
            <Link href="/blog" className="hover:text-foreground">Blog</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/app/dashboard">Go to app</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
