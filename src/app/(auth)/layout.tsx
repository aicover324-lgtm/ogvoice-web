import Link from "next/link";
import { CheckCircle2, Mic2, Shield } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#070b18] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.22),transparent_62%)]" />
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-[110px]" />
        <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-fuchsia-500/16 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-fuchsia-500 shadow-[0_4px_16px_rgba(6,182,212,0.45)]">
            <Mic2 className="h-4 w-4 text-white" />
          </span>
          OG Voice
        </Link>

        <Link href="/" className="text-sm text-slate-300 transition-colors hover:text-cyan-200">
          Back to home
        </Link>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 md:grid-cols-2 md:pt-14">
        <div className="hidden md:block">
          <div className="og-surface-glass og-lift og-hover-cyan rounded-3xl p-8 shadow-[0_24px_80px_rgba(2,8,23,0.45)]">
            <div className="og-chip-soft og-chip-cyan text-xs font-semibold uppercase tracking-[0.18em]">
              Premium Workflow
            </div>

            <h2 className="mt-5 text-3xl font-semibold leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
              Build your voice studio with a clean, modern flow.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Upload your recordings, start cloning, and manage your voice profiles in a single polished workspace.
            </p>

            <div className="mt-8 space-y-3 text-sm text-slate-200">
              {[
                { icon: CheckCircle2, text: "Simple steps from upload to clone" },
                { icon: Shield, text: "Account-based voice and file access" },
                { icon: Mic2, text: "Built for creators, not engineers" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-center md:justify-end">{children}</div>
      </div>
    </div>
  );
}
