"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumCard } from "@/components/app/premium-card";
import { VoiceActionsMenu } from "@/components/app/voice-actions-menu";
import { VoiceCoverHero } from "@/components/app/voice-cover-hero";
import { VoiceCoverThumb } from "@/components/app/voice-cover-thumb";
import { CloneVoicePanel, type CloneTrainingStatus } from "@/components/app/clone-voice-panel";

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
        progress: number;
        artifactKey: string | null;
        errorMessage: string | null;
      }
    | null;
};

type CardCloneVisualState = "idle" | "cloning" | "cloned" | "failed";

export function VoiceCloneCard({ voice, showUseAction }: { voice: VoiceCloneCardData; showUseAction?: boolean }) {
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

  const overlay =
    cloneState === "cloning" ? (
      <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border-[3px] border-cyan-400/95 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.9),0_0_26px_rgba(34,211,238,0.42)] animate-[og-clone-wall-pulse_1.8s_ease-in-out_infinite] will-change-[opacity,box-shadow,border-color]" />
    ) : cloneState === "cloned" ? (
      <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border-[3px] border-fuchsia-400/95 shadow-[inset_0_0_0_1px_rgba(232,121,249,0.88),0_0_20px_rgba(232,121,249,0.35)]" />
    ) : null;

  const failedHint = cloneState === "failed" ? toFailedHint(voice.latestTrainingJob?.errorMessage ?? null) : null;

  return (
    <PremiumCard
      className="h-full min-h-[560px] border-white/10 bg-[#101a35] p-4 text-slate-100"
      contentClassName="flex h-full flex-col"
      ringClassName="ring-white/10"
      overlay={overlay}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <VoiceCoverThumb voiceId={voice.id} size={40} />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              {meta.name}
            </div>
            <div className="truncate text-xs text-slate-400">{meta.language || "Language not set"}</div>
          </div>
        </div>
        <VoiceActionsMenu
          voiceId={voice.id}
          initialName={meta.name}
          initialLanguage={meta.language}
          initialDescription={meta.description}
          disabled={cloneState === "cloning"}
          disabledReason="Actions are locked while training is in progress."
          onVoiceUpdated={(next) => setMeta(next)}
          onCoverReplaced={() => {
            setNonce(Date.now());
          }}
        />
      </div>

      <VoiceCoverHero voiceId={voice.id} nonce={nonce} />

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={voice.hasDataset ? "secondary" : "outline"} className={voice.hasDataset ? "bg-white/10 text-slate-100" : "border-white/20 text-slate-300"}>
            {voice.hasDataset ? "singing record added" : "missing singing record"}
          </Badge>
          <span className={statusPillClass(cloneState)}>{statusPillLabel(cloneState)}</span>
          {failedHint ? <Badge variant="destructive">{failedHint}</Badge> : null}
        </div>

        <div className="mt-3 line-clamp-3 min-h-[60px] text-sm text-slate-300">
          {meta.description || "No notes yet. Add a short description from the menu."}
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold uppercase tracking-[0.08em] text-slate-400">Cloning status</span>
            <span className="font-semibold text-cyan-200">{statusPanelLabel(cloneState)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className={statusProgressClass(cloneState)} style={{ width: `${statusProgressWidth(cloneState)}%` }} />
          </div>
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
          initialProgress={voice.latestTrainingJob?.progress ?? 0}
          initialArtifactKey={voice.latestTrainingJob?.artifactKey ?? null}
          initialErrorMessage={voice.latestTrainingJob?.errorMessage ?? null}
        />
        {showUseAction && cloneState === "cloned" ? (
          <Button asChild variant="outline" className="mt-2 w-full rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer">
            <Link href={`/app/generate?voiceId=${encodeURIComponent(voice.id)}`}>Use This Voice</Link>
          </Button>
        ) : null}
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

function toFailedHint(errorMessage: string | null) {
  if (!errorMessage) return "cloning stopped";
  const lower = errorMessage.toLowerCase();
  if (lower.includes("cancel")) return "cloning stopped";
  if (lower.includes("timeout")) return "took too long";
  if (lower.includes("stuck")) return "got stuck";
  if (lower.includes("temporary") || lower.includes("network") || lower.includes("worker")) {
    return "temporary issue";
  }
  return "needs retry";
}

function statusPillLabel(state: CardCloneVisualState) {
  if (state === "cloning") return "Cloning now";
  if (state === "cloned") return "Ready";
  if (state === "failed") return "Needs retry";
  return "Not started";
}

function statusPanelLabel(state: CardCloneVisualState) {
  if (state === "cloning") return "In progress";
  if (state === "cloned") return "Completed";
  if (state === "failed") return "Stopped";
  return "Not started";
}

function statusPillClass(state: CardCloneVisualState) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (state === "cloning") return `${base} border-cyan-400/45 bg-cyan-400/10 text-cyan-200`;
  if (state === "cloned") return `${base} border-fuchsia-400/45 bg-fuchsia-500/15 text-fuchsia-200`;
  if (state === "failed") return `${base} border-red-400/40 bg-red-400/10 text-red-200`;
  return `${base} border-white/20 bg-white/5 text-slate-300`;
}

function statusProgressClass(state: CardCloneVisualState) {
  if (state === "failed") return "h-full rounded-full bg-red-400";
  if (state === "cloned") return "h-full rounded-full bg-fuchsia-400";
  return "h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400";
}

function statusProgressWidth(state: CardCloneVisualState) {
  if (state === "cloned") return 100;
  if (state === "cloning") return 58;
  if (state === "failed") return 28;
  return 8;
}
