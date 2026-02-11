import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PremiumCard } from "@/components/app/premium-card";

export default async function DashboardPage() {
  return (
    <main className="relative mx-auto max-w-6xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          Create Voice
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clone your AI singing voice in 3 simple steps.
        </p>
      </div>

      <Card className="relative mt-6 overflow-hidden border border-black/5 bg-white/70 p-0 shadow-[0_18px_60px_rgba(2,8,23,0.10)] backdrop-blur-md dark:border-white/10 dark:bg-slate-950/95 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="relative aspect-[21/9] w-full">
          <Image
            src="/create_voice_cover_upscayl_2x_upscayl-standard-4x.png"
            alt="Create AI Voice"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1100px"
          />
          {/* Vignette + readability overlay (tuned for light/dark) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-black/35 dark:from-black/25 dark:via-black/20 dark:to-black/55" />
          <div className="absolute inset-0 bg-[radial-gradient(110%_85%_at_50%_10%,rgba(0,0,0,0.0),rgba(0,0,0,0.28)),radial-gradient(75%_70%_at_15%_20%,rgba(0,150,255,0.12),transparent_55%),radial-gradient(70%_60%_at_85%_25%,rgba(255,60,210,0.10),transparent_55%)] dark:bg-[radial-gradient(110%_85%_at_50%_10%,rgba(0,0,0,0.0),rgba(0,0,0,0.42)),radial-gradient(75%_70%_at_15%_20%,rgba(0,210,255,0.18),transparent_55%),radial-gradient(70%_60%_at_85%_25%,rgba(255,60,210,0.16),transparent_55%)]" />
        </div>
        {/* Inner ring + subtle sheen */}
        <div className="pointer-events-none absolute inset-0 rounded-[var(--radius)] ring-1 ring-black/8 dark:ring-white/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/0 to-white/0 opacity-55 dark:from-white/10" />
      </Card>

      <div className="mt-8">
        <h2 className="text-center text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          HOW TO CLONE YOUR AI VOICE
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Upload a clean singing recording, name your voice, then start cloning.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <PremiumCard className="p-6">
          <div>
            <div className="inline-flex items-center rounded-full border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              STEP 1
            </div>
            <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Upload your singing audio
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Upload 10-20 minutes of clean, noise-free singing. No effects (no reverb, auto-tune, etc.).
              Singing only (not speaking). Use your full vocal range if you can.
              Small off-notes are totally fine.
            </p>
          </div>
        </PremiumCard>

        <PremiumCard className="p-6">
          <div>
            <div className="inline-flex items-center rounded-full border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              STEP 2
            </div>
            <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Name your voice
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              After uploading, give your AI voice a name and pick a cover image.
              Language and notes are optional.
            </p>
          </div>
        </PremiumCard>

        <PremiumCard className="p-6">
          <div>
            <div className="inline-flex items-center rounded-full border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              STEP 3
            </div>
            <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Start cloning
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Once you create the voice, go to the Clone Voice section to start cloning.
            </p>
          </div>
        </PremiumCard>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-r from-cyan-500/22 to-fuchsia-500/20 blur-2xl opacity-70 dark:from-cyan-500/28 dark:to-fuchsia-500/26" />
          <Link
            href="/app/voices/new"
            aria-label="Start creating an AI voice"
            className="group relative inline-flex h-12 items-center justify-center pl-7 pr-6 text-sm font-semibold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 shadow-[0_18px_60px_rgba(2,8,23,0.22)]" />
            <span className="pointer-events-none absolute -right-4 top-1/2 h-10 w-10 -translate-y-1/2 bg-gradient-to-r from-cyan-600 to-fuchsia-600 shadow-[0_18px_60px_rgba(2,8,23,0.22)] transition-transform duration-200 group-hover:translate-x-1 [clip-path:polygon(0_0,100%_50%,0_100%,18%_50%)]" />
            <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/15" />
            <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(60%_70%_at_30%_20%,rgba(255,255,255,0.26),transparent_55%)]" />

            <span className="relative z-10 inline-flex items-center gap-2">
              Start
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
