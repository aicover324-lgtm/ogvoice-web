"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/app/premium-card";
import { CustomAudioPlayer } from "@/components/app/custom-audio-player";
import { cn } from "@/lib/utils";

type ExampleKind = "good" | "bad";

type QualityExample = {
  id: string;
  title: string;
  description: string;
  kind: ExampleKind;
  src: string;
  bars: number[];
};

const EXAMPLES: QualityExample[] = [
  {
    id: "clean",
    title: "Correct Voice (Recommended)",
    description: "Clean.wav: clear single vocal, low noise, no reverb, no background music.",
    kind: "good",
    src: "/dataset-quality-audio/Clean.wav",
    bars: buildBars(0.84, 0.19, 0.12),
  },
  {
    id: "reverb",
    title: "Wrong: Reverb In Vocal",
    description: "Reverb.wav: room reflections blur vocal details and reduce cloning accuracy.",
    kind: "bad",
    src: "/dataset-quality-audio/Reverb.wav",
    bars: buildBars(0.9, 0.26, 0.33),
  },
  {
    id: "back-vocals",
    title: "Wrong: Back Vocals Present",
    description: "Back_Vocals.wav: extra singers overlap with the main voice and confuse cloning.",
    kind: "bad",
    src: "/dataset-quality-audio/Back_Vocals.wav",
    bars: buildBars(0.92, 0.3, 0.47),
  },
  {
    id: "song",
    title: "Wrong: Instrumental Included",
    description: "Song.wav: background instruments dominate and contaminate the voice profile.",
    kind: "bad",
    src: "/dataset-quality-audio/Song.wav",
    bars: buildBars(0.96, 0.35, 0.62),
  },
];

export function DatasetQualityGuide() {
  const good = EXAMPLES[0];
  const bad = EXAMPLES.slice(1);

  return (
    <PremiumCard className="border-white/10 bg-[#101b37] p-5 text-slate-100" ringClassName="ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100" style={{ fontFamily: "var(--font-heading)" }}>
          Voice Quality Guide
        </h3>
        <Badge variant="outline" className="border-cyan-300/40 bg-cyan-400/10 text-cyan-200">
          Real Examples
        </Badge>
      </div>

      <p className="mt-2 text-xs text-slate-300">
        Top sample is the correct reference. Compare it with wrong examples before uploading your singing record.
      </p>

      <QualityExampleCard example={good} prominent />

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {bad.map((item) => (
          <QualityExampleCard key={item.id} example={item} />
        ))}
      </div>
    </PremiumCard>
  );
}

function QualityExampleCard({
  example,
  prominent = false,
}: {
  example: QualityExample;
  prominent?: boolean;
}) {
  const isGood = example.kind === "good";
  const [playing, setPlaying] = React.useState(false);

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border p-3",
        isGood ? "border-emerald-300/30 bg-emerald-400/5" : "border-rose-300/25 bg-rose-400/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("text-sm font-semibold", isGood ? "text-emerald-100" : "text-rose-100")}>{example.title}</div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0",
            isGood
              ? "border-emerald-300/45 bg-emerald-400/12 text-emerald-200"
              : "border-rose-300/40 bg-rose-400/12 text-rose-200"
          )}
        >
          {isGood ? "Recommended" : "Avoid"}
        </Badge>
      </div>

      <div className="mt-1 text-xs text-slate-300">{example.description}</div>

      <WaveformBars bars={example.bars} kind={example.kind} prominent={prominent} playing={playing} />

      <CustomAudioPlayer
        src={example.src}
        preload="metadata"
        variant="compact"
        className="mt-2"
        onPlayStateChange={setPlaying}
      />
    </div>
  );
}

function WaveformBars({
  bars,
  kind,
  prominent,
  playing,
}: {
  bars: number[];
  kind: ExampleKind;
  prominent: boolean;
  playing: boolean;
}) {
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    if (!playing) {
      setPhase(0);
      return;
    }
    const timer = window.setInterval(() => {
      setPhase((prev) => (prev + 0.52) % (Math.PI * 2));
    }, 85);

    return () => {
      window.clearInterval(timer);
    };
  }, [playing]);

  return (
    <div
      className={cn(
        "mt-2 overflow-hidden rounded-lg border bg-[#0b1328] p-2",
        kind === "good" ? "border-emerald-300/20" : "border-rose-300/20",
        playing && kind === "good" ? "shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_0_24px_rgba(34,211,238,0.2)]" : "",
        playing && kind === "bad" ? "shadow-[0_0_0_1px_rgba(251,113,133,0.18),0_0_20px_rgba(251,146,60,0.16)]" : "",
        prominent ? "h-[108px]" : "h-[82px]"
      )}
    >
      <div className="flex h-full items-end gap-[2px]">
        {bars.map((bar, idx) => (
          (() => {
            const motion =
              !playing
                ? 1
                : 0.72 +
                  0.34 * Math.abs(Math.sin(phase + idx * 0.39)) +
                  0.12 * Math.abs(Math.sin(phase * 0.47 + idx * 0.19));
            const animated = Math.max(0.08, Math.min(1, bar * motion));
            return (
          <span
            key={`${kind}-${idx}-${Math.round(bar * 1000)}`}
            className={cn(
              "w-full rounded-full",
              kind === "good"
                ? "bg-gradient-to-t from-emerald-500/55 via-cyan-400/65 to-cyan-200/85"
                : "bg-gradient-to-t from-rose-500/55 via-orange-400/65 to-amber-200/80"
            )}
            style={{
              height: `${Math.max(10, Math.min(100, animated * 100))}%`,
              opacity: Math.min(1, 0.54 + ((idx % 8) * 0.05) + (playing ? 0.09 : 0)),
              transition: "height 90ms linear, opacity 180ms ease",
            }}
          />
            );
          })()
        ))}
      </div>
    </div>
  );
}

function buildBars(level: number, jitter: number, phase: number) {
  const bars: number[] = [];
  for (let i = 0; i < 84; i += 1) {
    const base = 0.32 + 0.52 * Math.abs(Math.sin((i + 1) * (0.18 + phase)));
    const wobble = Math.abs(Math.sin((i + 1) * (0.11 + jitter)) * 0.3);
    const value = Math.min(1, Math.max(0.08, (base + wobble) * level));
    bars.push(value);
  }
  return bars;
}
