import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Mic2,
  Music4,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "OG Voice | Clone your voice, create new vocals",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const steps = [
    {
      title: "Upload your voice",
      body: "Upload a short recording. OG Voice starts learning your tone and style.",
      icon: Upload,
    },
    {
      title: "Start cloning",
      body: "Tap Clone Voice. You can follow the process directly on the card.",
      icon: Mic2,
    },
    {
      title: "Create vocals",
      body: "Use your cloned voice to test ideas and shape the best take for your song.",
      icon: Music4,
    },
  ];

  const highlights = [
    {
      title: "Clean experience",
      body: "No clutter. You always know what to do next.",
      icon: Sparkles,
    },
    {
      title: "Safe storage",
      body: "Your recordings and profiles stay in your own account space.",
      icon: ShieldCheck,
    },
    {
      title: "Fast workflow",
      body: "Upload, clone, and create in one simple flow.",
      icon: Zap,
    },
    {
      title: "Easy control",
      body: "Edit voice details, replace cover art, and manage everything quickly.",
      icon: WandSparkles,
    },
  ];

  const faqs = [
    {
      q: "How long does cloning take?",
      a: "It depends on your recording length and queue load. Once started, you can track it directly on the card.",
    },
    {
      q: "Is my voice data safe?",
      a: "Yes. Your files stay tied to your account and are used only in your own workflow.",
    },
    {
      q: "Do I need technical skills to start?",
      a: "No. Just upload your voice, start cloning, and begin creating new vocal takes.",
    },
  ];

  return (
    <main className="bg-[#070b18] text-white">
      <section className="og-section-shell pt-10">
        <div className="og-glow-layer">
          <div className="og-glow-top-lg" />
          <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-[100px]" />
          <div className="absolute -right-12 top-16 h-80 w-80 rounded-full bg-fuchsia-500/18 blur-[110px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="og-chip-soft og-chip-cyan text-xs font-semibold uppercase tracking-[0.18em]">
              <Sparkles className="h-3.5 w-3.5" />
              Next-gen clone voice experience
            </div>

            <h1
              className="mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-6xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Clone your voice,
              <span className="block bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                give your songs a new identity.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              With OG Voice, you upload your recording, start cloning, and create fresh vocal ideas in a clean,
              easy-to-follow workflow.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="og-btn-gradient h-11 rounded-xl px-6 text-sm font-semibold"
              >
                <Link href="/register">Start free</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="og-btn-outline-soft h-11 rounded-xl border-white/20 bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Link href="#how-it-works">How it works</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-5xl md:mt-14">
            <div className="og-surface-panel rounded-[1.75rem] p-2 shadow-[0_28px_90px_rgba(2,8,23,0.45)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] border border-white/12">
                <video
                  src="/banner_video.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="h-full w-full object-cover will-change-transform motion-safe:animate-[og-video-drift_8s_ease-in-out_infinite]"
                  aria-label="OG Voice showcase video"
                />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_12%,rgba(255,255,255,0.06),transparent_55%)]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b18]/35 via-transparent to-transparent" />
              </div>
            </div>
          </div>

          <div className="og-surface-panel og-lift og-hover-cyan mx-auto mt-12 max-w-4xl rounded-3xl p-2 shadow-[0_26px_80px_rgba(2,8,23,0.45)]">
            <div className="rounded-2xl border border-white/10 bg-[#0d1328] p-5 md:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Clone Voice panel</div>
                  <div className="text-xs text-slate-400">Upload voice - Clone - Create</div>
                </div>
                <div className="og-chip-soft og-chip-cyan px-2.5 text-[11px] font-medium">
                  Live flow
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  { t: "Voice profile", d: "Name, language, and notes" },
                  { t: "Singing voice", d: "Upload your recording in one place" },
                  { t: "Clone status", d: "Real-time card animation while cloning" },
                  { t: "Model ready", d: "Start using your cloned voice immediately" },
                ].map((item, i) => (
                  <div key={item.t} className="og-surface-panel og-lift rounded-xl p-4 hover:border-cyan-300/35 hover:bg-white/[0.05]">
                    <div className="text-xs text-cyan-200">Step {i + 1}</div>
                    <div className="mt-1 text-sm font-semibold">{item.t}</div>
                    <p className="mt-1 text-xs text-slate-400">{item.d}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {["Quick setup", "Clean UI", "Fast results"].map((tag) => (
                  <span key={tag} className="og-chip-soft og-chip-muted px-2.5 text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-white/10 bg-[#050913] py-20">
        <div className="og-container">
          <div className="mb-12 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Process</div>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
              How it works
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.title}
                  className="og-lift og-hover-cyan border-white/10 bg-[#0a1021]/80 p-6 text-white shadow-[0_10px_40px_rgba(2,8,23,0.28)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/18 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                    {index + 1}. {step.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-white/10 bg-[#070d1d] py-20">
        <div className="og-container grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
              Not complicated,
              <span className="block bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                just creator-friendly.
              </span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              You should focus on your sound, not technical setup. OG Voice keeps every step simple and clear.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "Straightforward steps",
                "Clear status while cloning and creating",
                "Easy voice profile management in one place",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="og-lift og-hover-cyan border-white/10 bg-white/[0.04] p-5 text-white shadow-[0_10px_34px_rgba(2,8,23,0.25)]"
                >
                  <Icon className="h-5 w-5 text-fuchsia-300" />
                  <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-b border-white/10 bg-[#050913] py-20">
        <div className="og-container">
          <div className="text-center">
            <h2 className="text-3xl font-semibold md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
              Simple plans, clear choice
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
              Start free, then upgrade when your projects grow.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            <Card className="og-surface-dark og-lift og-hover-cyan p-6">
              <div className="text-sm text-slate-300">Starter</div>
              <div className="mt-2 text-4xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                $0
              </div>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                <li>Create 1 voice profile</li>
                <li>Access to core upload and clone flow</li>
                <li>Great for first tests</li>
              </ul>
              <Button asChild variant="outline" className="og-btn-outline-soft mt-6 h-11 w-full rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link href="/register">Start free</Link>
              </Button>
            </Card>

            <Card className="og-lift og-hover-fuchsia relative border-cyan-300/55 bg-[#0a1021]/95 p-6 text-white shadow-[0_0_0_1px_rgba(217,70,239,0.25)]">
              <div className="og-chip-soft og-chip-gradient absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                Most popular
              </div>
              <div className="text-sm text-slate-300">Pro</div>
              <div className="mt-2 text-4xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                $19
              </div>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                <li>Higher usage limits</li>
                <li>Priority workflow capacity</li>
                <li>More room for bigger projects</li>
              </ul>
              <Button
                asChild
                className="og-btn-gradient mt-6 h-11 w-full rounded-xl"
              >
                <Link href="/pricing">View plans</Link>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#070d1d] py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-semibold md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
            Frequently asked questions
          </h2>

          <div className="mt-10 space-y-3">
            {faqs.map((item) => (
              <Card key={item.q} className="og-surface-dark og-lift og-hover-cyan p-5">
                <div className="text-sm font-semibold md:text-base">{item.q}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.a}</p>
              </Card>
            ))}
          </div>

          <div className="og-surface-panel mt-10 rounded-2xl p-6 text-center">
            <div className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Ready to take your voice to the next level?
            </div>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
              Create your account, open your first voice profile, and jump into Clone Voice.
            </p>
            <Button
              asChild
              className="og-btn-gradient mt-5 h-11 rounded-xl px-6"
            >
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
