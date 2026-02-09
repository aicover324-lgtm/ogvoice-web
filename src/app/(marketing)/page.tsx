import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Voice Cloning + AI Singing (MVP)",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "OG Voice",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "OG Voice",
    description: "Voice cloning and AI singing platform (training coming soon).",
    brand: { "@type": "Brand", name: "OG Voice" },
  };

  return (
    <main>
      {/* JSON-LD for SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_0%,hsl(var(--primary)/0.12),transparent_65%),radial-gradient(40%_30%_at_10%_10%,hsl(var(--chart-2)/0.18),transparent_60%),radial-gradient(40%_30%_at_90%_20%,hsl(var(--chart-1)/0.16),transparent_60%)]" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center gap-6">
            <p className="text-sm text-muted-foreground">Professional workflow for AI voices</p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
              Voice cloning + AI singing platform foundation.
            </h1>
            <p className="text-base leading-7 text-muted-foreground md:text-lg">
              Upload 15-20 minutes of voice audio, manage your voice profiles, and generate songs (placeholder). Training is coming later on production infrastructure.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full">
                <Link href="/register">Create account</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              No model runs on this MVP yet; the system is built for secure uploads, auth, and a clean workflow.
            </div>
          </div>

          <div className="relative">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Workflow preview</div>
                  <div className="text-xs text-muted-foreground">Voices / Dataset / Versions</div>
                </div>
                <div className="text-xs rounded-full border px-2 py-1 text-muted-foreground">MVP</div>
              </div>
              <div className="mt-6 grid gap-3">
                {[
                  { k: "1", t: "Create voice profile", d: "Name, language, notes" },
                  { k: "2", t: "Upload dataset", d: "Pre-signed S3 uploads" },
                  { k: "3", t: "Training", d: "Coming soon" },
                  { k: "4", t: "Generate song", d: "Placeholder endpoints/UI" },
                ].map((s) => (
                  <div key={s.k} className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      {s.k}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.t}</div>
                      <div className="text-xs text-muted-foreground">{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[{
            title: "Secure uploads",
            body: "Direct-to-object-storage via pre-signed URLs. Server validates type, size, and quotas.",
          }, {
            title: "Voice library",
            body: "Profiles, datasets, and versioning scaffolding — designed for a clean, professional workflow.",
          }, {
            title: "Production foundations",
            body: "Auth, profiles, plan gating, Stripe scaffolding, SEO, and extensible data model.",
          }].map((f) => (
            <Card key={f.title} className="p-6">
              <div className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{f.title}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
