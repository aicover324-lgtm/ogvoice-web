import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
        <Card className="relative overflow-hidden rounded-2xl border border-black/5 bg-white/75 p-6 shadow-[0_12px_32px_rgba(2,8,23,0.10)] backdrop-blur-md dark:border-white/10 dark:bg-background/35 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-600/14 via-transparent to-fuchsia-600/14 dark:from-cyan-600/22 dark:to-fuchsia-600/18" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/7 dark:ring-white/10" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/0 to-white/0 opacity-60 dark:from-white/16" />
          <div className="relative">
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
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-black/5 bg-white/75 p-6 shadow-[0_12px_32px_rgba(2,8,23,0.10)] backdrop-blur-md dark:border-white/10 dark:bg-background/35 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-600/14 via-transparent to-fuchsia-600/14 dark:from-cyan-600/22 dark:to-fuchsia-600/18" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/7 dark:ring-white/10" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/0 to-white/0 opacity-60 dark:from-white/16" />
          <div className="relative">
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
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-black/5 bg-white/75 p-6 shadow-[0_12px_32px_rgba(2,8,23,0.10)] backdrop-blur-md dark:border-white/10 dark:bg-background/35 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-600/14 via-transparent to-fuchsia-600/14 dark:from-cyan-600/22 dark:to-fuchsia-600/18" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/7 dark:ring-white/10" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/0 to-white/0 opacity-60 dark:from-white/16" />
          <div className="relative">
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
        </Card>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/22 blur-xl dark:from-cyan-500/30 dark:to-fuchsia-500/28" />
          <Button
            asChild
            className="relative h-11 rounded-full px-6 text-sm font-semibold shadow-lg shadow-black/10 dark:shadow-black/30 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500"
          >
            <Link href="/app/voices/new">Create AI Voice</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
