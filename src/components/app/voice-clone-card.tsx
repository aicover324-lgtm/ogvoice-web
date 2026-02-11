"use client";

import * as React from "react";
import { Mic2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/app/premium-card";
import { VoiceActionsMenu } from "@/components/app/voice-actions-menu";
import { VoiceCoverHero } from "@/components/app/voice-cover-hero";
import { CloneVoicePanel, type CloneTrainingStatus } from "@/components/app/clone-voice-panel";
import { cn } from "@/lib/utils";

export type VoiceCloneCardData = {
  id: string;
  name: string;
  language: string | null;
  description: string | null;
  hasDataset: boolean;
  latestTrainingJob:
    | {
        id: string;
        status: CloneTrainingStatus;
        artifactKey: string | null;
        errorMessage: string | null;
      }
    | null;
};

type CardCloneVisualState = "idle" | "cloning" | "cloned" | "failed";

export function VoiceCloneCard({ voice }: { voice: VoiceCloneCardData }) {
  const [nonce, setNonce] = React.useState(() => Date.now());
  const [cloneState, setCloneState] = React.useState<CardCloneVisualState>(() =>
    toVisualState(voice.latestTrainingJob?.status ?? null)
  );
  const [meta, setMeta] = React.useState(() => ({
    name: voice.name,
    language: voice.language,
    description: voice.description,
  }));

  React.useEffect(() => {
    setMeta({ name: voice.name, language: voice.language, description: voice.description });
  }, [voice.name, voice.language, voice.description]);

  React.useEffect(() => {
    setCloneState(toVisualState(voice.latestTrainingJob?.status ?? null));
  }, [voice.latestTrainingJob?.status]);

  const ringClassName = cn(
    cloneState === "cloning" && "ring-cyan-500/70 dark:ring-cyan-400/75",
    cloneState === "cloned" && "ring-fuchsia-500/75 dark:ring-fuchsia-400/80"
  );

  return (
    <PremiumCard
      className="h-full min-h-[520px] p-5"
      contentClassName="flex h-full flex-col"
      ringClassName={ringClassName}
      overlay={cloneState === "cloning" ? <TrainingOrbitOverlay /> : null}
    >
      <div className="mb-3 flex justify-end">
        <VoiceActionsMenu
          voiceId={voice.id}
          initialName={meta.name}
          initialLanguage={meta.language}
          initialDescription={meta.description}
          onVoiceUpdated={(next) => setMeta(next)}
          onCoverReplaced={() => {
            setNonce(Date.now());
          }}
        />
      </div>

      <VoiceCoverHero voiceId={voice.id} nonce={nonce} />

      <div className="mt-4">
        <div className="text-base font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          {meta.name}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{meta.language || "Language"}</Badge>
          <Badge variant={voice.hasDataset ? "secondary" : "outline"}>
            {voice.hasDataset ? "recording ready" : "missing recording"}
          </Badge>
        </div>

        <div className="mt-3 line-clamp-3 min-h-[60px] text-sm text-muted-foreground">
          {meta.description || "No notes"}
        </div>
      </div>

      <div className="mt-auto pt-5">
        <CloneVoicePanel
          voiceProfileId={voice.id}
          hasDataset={voice.hasDataset}
          compact
          onVisualStateChange={setCloneState}
          initialJobId={voice.latestTrainingJob?.id ?? null}
          initialStatus={voice.latestTrainingJob?.status ?? null}
          initialArtifactKey={voice.latestTrainingJob?.artifactKey ?? null}
          initialErrorMessage={voice.latestTrainingJob?.errorMessage ?? null}
        />
      </div>
    </PremiumCard>
  );
}

function TrainingOrbitOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl [--orbit-gap:10px] [--orbit-size:26px] [--orbit-duration:3.4s]">
      <div className="absolute inset-0 rounded-2xl p-[1.5px] [background:conic-gradient(from_0deg,rgba(6,182,212,0)_0deg,rgba(6,182,212,0)_318deg,rgba(6,182,212,0.98)_352deg,rgba(6,182,212,0.24)_360deg)] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [-webkit-mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [-webkit-mask-composite:xor] motion-safe:animate-[spin_var(--orbit-duration)_linear_infinite]" />

      <div className="absolute left-[var(--orbit-gap)] top-[var(--orbit-gap)] motion-safe:animate-[og-voice-orbit-rect_var(--orbit-duration)_linear_infinite]">
        <div className="relative flex h-[var(--orbit-size)] w-[var(--orbit-size)] items-center justify-center rounded-full bg-cyan-500 text-white shadow-[0_0_0_2px_rgba(6,182,212,0.35),0_10px_28px_rgba(6,182,212,0.48)] motion-safe:animate-[og-voice-orbit-facing_var(--orbit-duration)_linear_infinite]">
          <span className="absolute right-full top-1/2 h-[2px] w-20 -translate-y-1/2 bg-gradient-to-l from-cyan-400/95 via-cyan-400/45 to-transparent blur-[0.75px]" />
          <span className="absolute right-full top-1/2 h-2 w-24 -translate-y-1/2 bg-gradient-to-l from-cyan-400/35 via-cyan-400/14 to-transparent blur-md" />
          <Mic2 className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

function toVisualState(status: CloneTrainingStatus | null): CardCloneVisualState {
  if (status === "queued" || status === "running") return "cloning";
  if (status === "succeeded") return "cloned";
  if (status === "failed") return "failed";
  return "idle";
}
