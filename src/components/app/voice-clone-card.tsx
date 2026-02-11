"use client";

import * as React from "react";
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
    cloneState === "idle" && ""
  );

  const overlay =
    cloneState === "cloning" ? (
      <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border-[5px] border-cyan-400/95 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.9),0_0_26px_rgba(34,211,238,0.42)] motion-safe:animate-[og-clone-wall-pulse_2.8s_ease-in-out_infinite]" />
    ) : cloneState === "cloned" ? (
      <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border-[5px] border-fuchsia-400/95 shadow-[inset_0_0_0_1px_rgba(232,121,249,0.88),0_0_20px_rgba(232,121,249,0.35)]" />
    ) : null;

  return (
    <PremiumCard
      className="h-full min-h-[520px] p-5"
      contentClassName="flex h-full flex-col"
      ringClassName={ringClassName}
      overlay={overlay}
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

function toVisualState(status: CloneTrainingStatus | null): CardCloneVisualState {
  if (status === "queued" || status === "running") return "cloning";
  if (status === "succeeded") return "cloned";
  if (status === "failed") return "failed";
  return "idle";
}
