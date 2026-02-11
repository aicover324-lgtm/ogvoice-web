import type { Metadata } from "next";
import { HelpCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "FAQ",
  alternates: { canonical: "/faq" },
};

const faqs = [
  {
    q: "How long does voice cloning take?",
    a: "Timing depends on queue load and your recording length. Once it starts, you can follow progress from the clone card animation.",
  },
  {
    q: "What kind of recording should I upload?",
    a: "Use a clean singing or speaking recording with minimal background noise. Clear audio gives better cloning quality.",
  },
  {
    q: "Is my voice data private?",
    a: "Yes. Your uploads are tied to your account and used in your own workflow. Your voice assets are not shared publicly.",
  },
  {
    q: "Can I edit a voice profile later?",
    a: "Yes. You can update profile details, replace cover image, and manage your voice cards at any time.",
  },
  {
    q: "Where do I start as a new user?",
    a: "Create an account, open your first voice profile, upload a recording, and press Clone Voice.",
  },
  {
    q: "What happens after cloning is complete?",
    a: "The clone card switches to success state automatically, and your model becomes ready for the next generation flow.",
  },
];

export default function FaqPage() {
  return (
    <main className="bg-[#070b18] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.2),transparent_64%)]" />
          <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-cyan-500/18 blur-[100px]" />
          <div className="absolute -right-20 top-8 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-[110px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Quick answers
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
              Frequently asked questions
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Everything you need to know before starting your first clone in OG Voice.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <Card
                key={item.q}
                className="rounded-2xl border-white/12 bg-[#0a1021]/88 p-6 text-white shadow-[0_12px_44px_rgba(2,8,23,0.32)]"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <div>
                    <div className="text-sm font-semibold md:text-base">{item.q}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.a}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
