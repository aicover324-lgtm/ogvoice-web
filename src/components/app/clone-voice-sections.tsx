"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceCloneCard, type VoiceCloneCardData } from "@/components/app/voice-clone-card";

type ReadyFilter = "all" | "missing_record" | "failed" | "cloning_now";
const READY_FILTER_QUERY_KEY = "rf";

export function CloneVoiceSections({ voices }: { voices: VoiceCloneCardData[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const readyFilter = parseReadyFilter(searchParams.get(READY_FILTER_QUERY_KEY));
  const [continueOpen, setContinueOpen] = React.useState(true);
  const [readyOpen, setReadyOpen] = React.useState(true);

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
    <div className="mt-6 space-y-8">
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile label="Ready To Clone" value={readyVoices.length} />
          <SummaryTile label="Cloned" value={clonedVoices.length} />
          <SummaryTile label="Cloning Now" value={cloningNowCount} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0f1831] p-4 md:p-5">
        <button
          type="button"
          onClick={() => setContinueOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
          aria-expanded={continueOpen}
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Continue Cloning
            </h2>
            <span className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
              {readyVoices.length}
            </span>
          </div>
          <ChevronDown className={cn("h-5 w-5 text-slate-300 transition-transform", continueOpen && "rotate-180")} />
        </button>

        {continueOpen ? (
          <>
            <p className="mt-2 text-sm text-slate-300">Pick a voice below, check status, and start cloning in one click.</p>

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
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0f1831] p-4 md:p-5">
        <button
          type="button"
          onClick={() => setReadyOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
          aria-expanded={readyOpen}
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Ready Voices
            </h2>
            <span className="inline-flex items-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-200">
              {clonedVoices.length}
            </span>
          </div>
          <ChevronDown className={cn("h-5 w-5 text-slate-300 transition-transform", readyOpen && "rotate-180")} />
        </button>

        {readyOpen ? (
          <>
            <p className="mt-2 text-sm text-slate-300">These voices are ready to use in Generate.</p>
            <VoiceGrid items={clonedVoices} emptyText="No cloned voices yet." showUseAction />
          </>
        ) : null}
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
    <div className="mt-4 grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">{emptyText}</div>
      ) : (
        items.map((v) => <VoiceCloneCard key={v.id} voice={v} showUseAction={showUseAction} />)
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#101b37] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-100">{value}</div>
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
          : "border-white/15 bg-white/[0.03] text-slate-300 hover:border-white/30 hover:text-slate-100"
      )}
    >
      <span>{label}</span>
      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none">{count}</span>
    </button>
  );
}
