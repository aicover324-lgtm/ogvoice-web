"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { VoiceCloneCard, type VoiceCloneCardData } from "@/components/app/voice-clone-card";

type ReadyFilter = "all" | "missing_record" | "failed" | "cloning_now";
const READY_FILTER_QUERY_KEY = "rf";

export function CloneVoiceSections({ voices }: { voices: VoiceCloneCardData[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const readyFilter = parseReadyFilter(searchParams.get(READY_FILTER_QUERY_KEY));

  const readyVoices = React.useMemo(
    () => voices.filter((v) => v.latestTrainingJob?.status !== "succeeded"),
    [voices]
  );
  const clonedVoices = React.useMemo(
    () => voices.filter((v) => v.latestTrainingJob?.status === "succeeded"),
    [voices]
  );
  const cloningNowCount = React.useMemo(
    () => voices.filter((v) => v.latestTrainingJob?.status === "queued" || v.latestTrainingJob?.status === "running").length,
    [voices]
  );

  const filteredReadyVoices = React.useMemo(() => {
    if (readyFilter === "all") return readyVoices;
    if (readyFilter === "missing_record") return readyVoices.filter((v) => !v.hasDataset);
    if (readyFilter === "failed") return readyVoices.filter((v) => v.latestTrainingJob?.status === "failed");
    return readyVoices.filter((v) => v.latestTrainingJob?.status === "queued" || v.latestTrainingJob?.status === "running");
  }, [readyFilter, readyVoices]);

  const setReadyFilter = React.useCallback(
    (next: ReadyFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") {
        params.delete(READY_FILTER_QUERY_KEY);
      } else {
        params.set(READY_FILTER_QUERY_KEY, next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="mt-8 space-y-10">
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile label="Ready To Clone" value={readyVoices.length} />
          <SummaryTile label="Cloned" value={clonedVoices.length} />
          <SummaryTile label="Cloning Now" value={cloningNowCount} />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Ready To Clone Voices
          </h2>
          <span className="og-chip-soft">{readyVoices.length}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip
            label="All"
            active={readyFilter === "all"}
            onClick={() => setReadyFilter("all")}
            count={readyVoices.length}
          />
          <FilterChip
            label="Missing Singing Record"
            active={readyFilter === "missing_record"}
            onClick={() => setReadyFilter("missing_record")}
            count={readyVoices.filter((v) => !v.hasDataset).length}
          />
          <FilterChip
            label="Needs Retry"
            active={readyFilter === "failed"}
            onClick={() => setReadyFilter("failed")}
            count={readyVoices.filter((v) => v.latestTrainingJob?.status === "failed").length}
          />
          <FilterChip
            label="Cloning Now"
            active={readyFilter === "cloning_now"}
            onClick={() => setReadyFilter("cloning_now")}
            count={readyVoices.filter((v) => v.latestTrainingJob?.status === "queued" || v.latestTrainingJob?.status === "running").length}
          />
        </div>

        <VoiceGrid items={filteredReadyVoices} emptyText="No voices match this filter." />
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Cloned Voices
          </h2>
          <span className="og-chip-soft">{clonedVoices.length}</span>
        </div>
        <VoiceGrid items={clonedVoices} emptyText="No cloned voices yet." showUseAction />
      </section>
    </div>
  );
}

function parseReadyFilter(value: string | null): ReadyFilter {
  if (value === "missing_record") return "missing_record";
  if (value === "failed") return "failed";
  if (value === "cloning_now") return "cloning_now";
  return "all";
}

function VoiceGrid({
  items,
  emptyText,
  showUseAction,
}: {
  items: VoiceCloneCardData[];
  emptyText: string;
  showUseAction?: boolean;
}) {
  return (
    <div className="mt-4 grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        items.map((v) => <VoiceCloneCard key={v.id} voice={v} showUseAction={showUseAction} />)
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-background/40 px-4 py-3 dark:border-white/10">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-cyan-400/45 bg-cyan-500/12 text-cyan-300"
          : "border-black/10 bg-background/40 text-muted-foreground hover:border-black/20 hover:text-foreground dark:border-white/10 dark:hover:border-white/20"
      )}
    >
      <span>{label}</span>
      <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] leading-none dark:bg-white/15">{count}</span>
    </button>
  );
}
