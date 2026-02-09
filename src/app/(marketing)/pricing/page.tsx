import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckoutButton } from "@/components/site/checkout-button";

export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-14">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          Pricing
        </h1>
        <p className="mt-3 text-muted-foreground">
          Subscription scaffolding is wired via Stripe (test mode). Plan gating is enforced on upload size/quotas.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="text-sm font-medium">Free</div>
          <div className="mt-2 text-3xl font-semibold">$0</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Voice library</li>
            <li>Dataset uploads (quota-limited)</li>
            <li>Training jobs (stub)</li>
          </ul>
          <div className="mt-6">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-primary/30">
          <div className="text-sm font-medium">Pro</div>
          <div className="mt-2 text-3xl font-semibold">$19</div>
          <div className="text-sm text-muted-foreground">per month</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Higher dataset quotas</li>
            <li>Priority job runner integration (future)</li>
            <li>Billing portal access</li>
          </ul>
          <div className="mt-6 flex flex-col gap-2">
            <CheckoutButton label="Upgrade (Stripe)" />
            <div className="text-xs text-muted-foreground">
              Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_PRO_MONTHLY` to enable checkout.
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
