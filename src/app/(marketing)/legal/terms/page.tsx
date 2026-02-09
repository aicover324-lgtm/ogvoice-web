import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
        Terms of Service
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
        <p>Template terms for MVP only. Replace with counsel-reviewed terms before production.</p>
        <div>
          <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
          <p>You must have rights to the audio you upload. Do not upload sensitive or illegal content.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">AI outputs</h2>
          <p>This MVP does not produce real voice cloning outputs yet; generation endpoints are placeholders.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Billing</h2>
          <p>Subscriptions are handled via Stripe when configured.</p>
        </div>
      </div>
    </main>
  );
}
