import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          OG Voice
        </Link>
        <ThemeToggle />
      </div>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-8 md:grid-cols-2 md:pt-14">
        <div className="hidden md:block">
          <div className="rounded-2xl border bg-[radial-gradient(70%_60%_at_30%_20%,hsl(var(--primary)/0.14),transparent_60%),radial-gradient(50%_40%_at_90%_10%,hsl(var(--chart-2)/0.18),transparent_60%)] p-8">
            <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Build your AI voice library.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Secure uploads, user profiles, and a clean dashboard built to scale on production infrastructure.
            </p>
            <div className="mt-6 text-xs text-muted-foreground">
              Tip: start with 15-20 minutes of clean, raw voice recordings.
            </div>
          </div>
        </div>
        <div className="flex items-start justify-center md:justify-end">{children}</div>
      </div>
    </div>
  );
}
