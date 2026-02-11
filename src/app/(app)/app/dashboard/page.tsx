import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          Create Voice
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sadece 3 adimda AI sesini klonla.
        </p>
      </div>

      <Card className="relative mt-6 overflow-hidden border bg-background/30 p-0">
        <div className="relative aspect-[21/9] w-full">
          <Image
            src="/create_voice_cover.png"
            alt="Create AI Voice"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1100px"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/35 to-background/90" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_20%,rgba(0,210,255,0.18),transparent_55%),radial-gradient(60%_60%_at_80%_25%,rgba(255,60,210,0.14),transparent_55%)]" />
        </div>
      </Card>

      <div className="mt-8">
        <h2 className="text-center text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          HOW TO CLONE YOUR AI VOICE
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Temiz bir sarki kaydi yukle, sesine isim ver, sonra klonlamayi baslat.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden rounded-2xl border bg-background/35 p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_10%_0%,rgba(0,210,255,0.18),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(255,60,210,0.14),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              STEP 1
            </div>
            <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Sarki kaydini yukle
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              10-20 dakikalik temiz, noise-free ve efektsiz (reverb, auto-tune vb. olmayan) bir sarki kaydi yukle.
              Konusma sesi degil, sarki soyleme sesi olmali. En iyi sonuc icin vokal araligini kullanmaya calis.
              Kucuk detoneler sorun degil.
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border bg-background/35 p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_10%_0%,rgba(0,180,255,0.16),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(160,120,255,0.12),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              STEP 2
            </div>
            <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Sesine isim ver
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Kaydi yukledikten sonra AI sesine bir isim ver ve bir kapak fotografi sec.
              Dil ve notlar opsiyonel.
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border bg-background/35 p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_10%_0%,rgba(0,210,255,0.14),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(255,60,210,0.12),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              STEP 3
            </div>
            <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Klonlamaya basla
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sesi olusturduktan sonra klonlamak icin Clone Voice kismina gecebilirsin.
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          asChild
          className="h-11 rounded-full px-6 text-sm font-semibold shadow-lg shadow-black/30 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400"
        >
          <Link href="/app/voices/new">Create AI Voice</Link>
        </Button>
      </div>
    </main>
  );
}
