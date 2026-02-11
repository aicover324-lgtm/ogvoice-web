import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckoutButton } from "@/components/site/checkout-button";

export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className="bg-[#070b18] text-white">
      <section className="og-section-shell">
        <div className="og-glow-layer">
          <div className="og-glow-top-md" />
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-cyan-500/18 blur-[100px]" />
          <div className="absolute -right-16 top-8 h-72 w-72 rounded-full bg-fuchsia-500/16 blur-[110px]" />
        </div>

        <div className="og-section-inner">
          <div className="og-section-head">
            <div className="og-chip-soft og-chip-cyan text-xs font-semibold uppercase tracking-[0.16em]">
              <Sparkles className="h-3.5 w-3.5" />
              Transparent pricing
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
              Pick the plan that fits your workflow
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Start for free, then upgrade when you need more room for voice cloning and generation.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
            <Card className="og-surface-dark og-lift og-hover-cyan rounded-3xl p-7 shadow-[0_16px_60px_rgba(2,8,23,0.35)]">
              <div className="text-sm font-medium text-slate-300">Starter</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  $0
                </span>
                <span className="pb-1 text-sm text-slate-400">/month</span>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                {[
                  "Create 1 voice profile",
                  "Core upload and clone workflow",
                  "Perfect for first tests",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant="outline"
                className="og-btn-outline-soft mt-8 h-11 w-full rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/register">Start free</Link>
              </Button>
            </Card>

            <Card className="og-lift og-hover-fuchsia relative rounded-3xl border-cyan-300/55 bg-[#0a1021]/95 p-7 text-white shadow-[0_0_0_1px_rgba(217,70,239,0.25),0_20px_70px_rgba(2,8,23,0.4)]">
              <div className="og-chip-soft og-chip-gradient absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                Most popular
              </div>

              <div className="text-sm font-medium text-slate-300">Pro</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  $19
                </span>
                <span className="pb-1 text-sm text-slate-400">/month</span>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                {[
                  "Higher usage limits",
                  "Priority capacity for busy queues",
                  "Billing portal access",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <CheckoutButton
                  label="Upgrade with Stripe"
                  className="shadow-[0_10px_32px_rgba(6,182,212,0.3)]"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_PRO_MONTHLY` to enable checkout.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
