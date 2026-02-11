"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/app/premium-card";
import { VoiceActionsMenu } from "@/components/app/voice-actions-menu";
import { VoiceCoverHero } from "@/components/app/voice-cover-hero";
import { CloneVoicePanel } from "@/components/app/clone-voice-panel";

export type VoiceCloneCardData = {
  id: string;
  name: string;
  language: string | null;
  description: string | null;
  hasDataset: boolean;
};

export function VoiceCloneCard({ voice }: { voice: VoiceCloneCardData }) {
  const [nonce, setNonce] = React.useState(() => Date.now());

  return (
    <PremiumCard className="h-full min-h-[520px] p-5" contentClassName="flex h-full flex-col">
      <div className="relative">
        <VoiceCoverHero voiceId={voice.id} nonce={nonce} />
        <div className="absolute right-2 top-2">
          <VoiceActionsMenu
            voiceId={voice.id}
            onCoverReplaced={() => {
              setNonce(Date.now());
            }}
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-base font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          {voice.name}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{voice.language || "Language"}</Badge>
          <Badge variant={voice.hasDataset ? "secondary" : "outline"}>
            {voice.hasDataset ? "recording ready" : "missing recording"}
          </Badge>
        </div>

        <div className="mt-3 line-clamp-3 min-h-[60px] text-sm text-muted-foreground">
          {voice.description || "No notes"}
        </div>
      </div>

      <div className="mt-auto pt-5">
        <CloneVoicePanel voiceProfileId={voice.id} hasDataset={voice.hasDataset} compact />
      </div>
    </PremiumCard>
  );
}
