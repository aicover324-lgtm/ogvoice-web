"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CloneTrainingStatus = "queued" | "running" | "succeeded" | "failed";
export type ClonePanelVisualState = "idle" | "cloning" | "cloned" | "failed";

const INFRA_AUTO_RETRY_MARKER = "[auto-retry:1]";

export function CloneVoicePanel({
  voiceProfileId,
  hasDataset,
  compact,
  onVisualStateChange,
  initialJobId,
  initialStatus,
  initialProgress,
  initialArtifactKey,
  initialErrorMessage,
}: {
  voiceProfileId: string;
  hasDataset: boolean;
  compact?: boolean;
  onVisualStateChange?: (state: ClonePanelVisualState) => void;
  initialJobId?: string | null;
  initialStatus?: CloneTrainingStatus | null;
  initialProgress?: number | null;
  initialArtifactKey?: string | null;
  initialErrorMessage?: string | null;
}) {
  const router = useRouter();
  const [starting, setStarting] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(initialJobId ?? null);
  const [status, setStatus] = React.useState<CloneTrainingStatus | null>(initialStatus ?? null);
  const [progress, setProgress] = React.useState<number>(Math.max(0, Math.min(100, initialProgress ?? 0)));
  const [artifactKey, setArtifactKey] = React.useState<string | null>(initialArtifactKey ?? null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(initialErrorMessage ?? null);
  const lastStatusRef = React.useRef<CloneTrainingStatus | null>(initialStatus ?? null);
  const successNotifiedRef = React.useRef(initialStatus === "succeeded");
  const failedNotifiedRef = React.useRef(initialStatus === "failed");
  const retryNotifiedRef = React.useRef(false);

  React.useEffect(() => {
    setJobId(initialJobId ?? null);
    setStatus(initialStatus ?? null);
    setProgress(Math.max(0, Math.min(100, initialProgress ?? 0)));
    setArtifactKey(initialArtifactKey ?? null);
    setErrorMessage(initialErrorMessage ?? null);
    lastStatusRef.current = initialStatus ?? null;
    successNotifiedRef.current = initialStatus === "succeeded";
    failedNotifiedRef.current = initialStatus === "failed";
    retryNotifiedRef.current = false;
  }, [initialArtifactKey, initialErrorMessage, initialJobId, initialProgress, initialStatus]);

  const refresh = React.useCallback(
    async (nextJobId: string) => {
      const res = await fetch(`/api/training/status?jobId=${encodeURIComponent(nextJobId)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return;

      const j = json.data.job as {
        status: CloneTrainingStatus;
        progress?: number | null;
        artifactKey?: string | null;
        errorMessage?: string | null;
      };
      setStatus(j.status);
      setProgress(Math.max(0, Math.min(100, Number(j.progress ?? 0))));
      setArtifactKey(j.artifactKey ?? null);
      setErrorMessage(j.errorMessage ?? null);

      if (j.status === "succeeded" && lastStatusRef.current !== "succeeded") {
        router.refresh();
      }
      lastStatusRef.current = j.status;
    },
    [router]
  );

  React.useEffect(() => {
    if (!jobId) return;
    if (status === "succeeded" || status === "failed") return;
    const t = setInterval(() => void refresh(jobId), 5000);
    return () => clearInterval(t);
  }, [jobId, refresh, status]);

  const inFlight = starting || status === "running" || status === "queued";

  React.useEffect(() => {
    const next: ClonePanelVisualState =
      status === "succeeded" ? "cloned" : inFlight ? "cloning" : status === "failed" ? "failed" : "idle";
    onVisualStateChange?.(next);
  }, [inFlight, onVisualStateChange, status]);

  React.useEffect(() => {
    if (status === "succeeded" && !successNotifiedRef.current) {
      toast.success("Voice cloned successfully.");
      successNotifiedRef.current = true;
      failedNotifiedRef.current = false;
      return;
    }
    if (status === "failed" && !failedNotifiedRef.current) {
      toast.error("Voice cloning failed.");
      failedNotifiedRef.current = true;
      successNotifiedRef.current = false;
      return;
    }
    if (status !== "succeeded") successNotifiedRef.current = false;
    if (status !== "failed") failedNotifiedRef.current = false;
  }, [status]);

  const autoRetryActive =
    (status === "queued" || status === "running") && !!errorMessage?.includes(INFRA_AUTO_RETRY_MARKER);

  React.useEffect(() => {
    if (autoRetryActive && !retryNotifiedRef.current) {
      toast.message("Temporary server issue detected. Retrying automatically...");
      retryNotifiedRef.current = true;
      return;
    }
    if (!autoRetryActive) retryNotifiedRef.current = false;
  }, [autoRetryActive]);

  async function start() {
    if (!hasDataset) {
      toast.error("Upload your singing record first.");
      return;
    }
    setStarting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/training/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceProfileId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Failed to start training");
      }
      const nextJobId = String(json.data.jobId);
      setJobId(nextJobId);
      setStatus("queued");
      setProgress(5);
      toast.success("Cloning started.");
      await refresh(nextJobId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start training");
    } finally {
      setStarting(false);
    }
  }

  const canStart = hasDataset && !starting && !inFlight && status !== "succeeded";
  const progressValue = derivedProgress(status, progress, starting);

  const statusText =
    status === "queued"
      ? "In queue"
      : status === "running"
        ? "Cloning now"
        : status === "succeeded"
          ? "Completed"
          : status === "failed"
            ? "Stopped"
            : "Not started";

  const helperText =
    status === "queued"
      ? "We are waiting for a GPU slot."
      : status === "running"
        ? "Cloning in progress. We update this panel automatically."
        : status === "succeeded"
          ? "Your voice can now be used in Generate."
          : status === "failed"
            ? "Cloning stopped. You can retry now."
            : "Press Start Cloning when your singing record is ready.";

  const inlineInfo = autoRetryActive ? "Temporary issue detected. Auto-retry is running." : null;
  const inlineError = toUserFacingError(status, errorMessage);

  if (compact) {
    return (
      <div className="rounded-2xl border border-cyan-400/20 bg-[#111a31] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <StatusPill status={status} />
          <span className="text-xs font-semibold text-cyan-200">{progressValue}%</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              status === "failed"
                ? "bg-red-400"
                : status === "succeeded"
                  ? "bg-fuchsia-400"
                  : "bg-gradient-to-r from-cyan-400 to-fuchsia-400"
            )}
            style={{ width: `${Math.max(4, progressValue)}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>

        {status === "succeeded" ? (
          <div className="mt-2 inline-flex h-8 items-center rounded-full border border-fuchsia-400/45 bg-fuchsia-500/15 px-3 text-xs font-semibold text-fuchsia-200">
            Voice ready
          </div>
        ) : (
          <Button
            type="button"
            className="og-btn-gradient mt-2 w-full rounded-full cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
            onClick={() => void start()}
            disabled={!canStart}
          >
            {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {starting ? "Starting..." : status === "failed" ? "Retry Cloning" : "Start Cloning"}
          </Button>
        )}

        {inlineInfo ? <div className="mt-2 text-xs text-cyan-200">{inlineInfo}</div> : null}
        {inlineError ? <div className="mt-2 text-xs text-red-300">{inlineError}</div> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-[#0f162d] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            Cloning Panel
          </h3>
          <p className="mt-1 text-sm text-slate-300">Simple live status for your voice cloning job.</p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-xl border border-white/10 bg-[#121c37] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-100">Progress</span>
            <span className="text-sm font-semibold text-cyan-200">{progressValue}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                status === "failed"
                  ? "bg-red-400"
                  : status === "succeeded"
                    ? "bg-fuchsia-400"
                    : "bg-gradient-to-r from-cyan-400 to-fuchsia-400"
              )}
              style={{ width: `${Math.max(4, progressValue)}%` }}
            />
          </div>

          <p className="mt-2 text-sm text-slate-300">{helperText}</p>
          {inlineInfo ? <p className="mt-2 text-xs text-cyan-200">{inlineInfo}</p> : null}
          {inlineError ? <p className="mt-2 text-xs text-red-300">{inlineError}</p> : null}
          {artifactKey && status === "succeeded" ? (
            <p className="mt-2 text-xs text-emerald-300">Model version is ready.</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {status === "succeeded" ? (
              <div className="inline-flex h-9 items-center rounded-full border border-fuchsia-400/45 bg-fuchsia-500/15 px-4 text-sm font-semibold text-fuchsia-200">
                Cloning complete
              </div>
            ) : (
              <Button
                type="button"
                className="og-btn-gradient rounded-full px-6 cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                onClick={() => void start()}
                disabled={!canStart}
              >
                {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {starting ? "Starting..." : status === "failed" ? "Retry Cloning" : "Start Cloning"}
              </Button>
            )}
            {jobId ? <span className="text-xs text-slate-400">Job {jobId.slice(0, 10)}</span> : null}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#121c37] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Quick checks</div>
          <div className="mt-3 space-y-2.5">
            <QuickCheckItem
              ok={hasDataset}
              label="Singing record"
              note={hasDataset ? "Ready" : "Please upload a record"}
            />
            <QuickCheckItem
              ok={status === "running" || status === "queued" || status === "succeeded"}
              label="Cloning status"
              note={statusText}
            />
            <QuickCheckItem
              ok={status === "succeeded"}
              label="Ready for Generate"
              note={status === "succeeded" ? "You can start creating now" : "Available after cloning"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: CloneTrainingStatus | null }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]";

  if (status === "running" || status === "queued") {
    return (
      <span className={cn(base, "border-cyan-400/40 bg-cyan-400/10 text-cyan-200")}>
        <LoaderCircle className="h-3 w-3 animate-spin" />
        Cloning
      </span>
    );
  }

  if (status === "succeeded") {
    return (
      <span className={cn(base, "border-fuchsia-400/45 bg-fuchsia-500/15 text-fuchsia-200")}>
        <Sparkles className="h-3 w-3" />
        Done
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className={cn(base, "border-red-400/40 bg-red-400/10 text-red-200")}>
        <CircleAlert className="h-3 w-3" />
        Needs retry
      </span>
    );
  }

  return (
    <span className={cn(base, "border-white/20 bg-white/5 text-slate-300")}>
      <CircleAlert className="h-3 w-3" />
      Not started
    </span>
  );
}

function QuickCheckItem({ ok, label, note }: { ok: boolean; label: string; note: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <span
        className={cn(
          "mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full",
          ok ? "bg-emerald-400/20 text-emerald-300" : "bg-slate-400/20 text-slate-400"
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-100">{label}</div>
        <div className="text-[11px] text-slate-400">{note}</div>
      </div>
    </div>
  );
}

function derivedProgress(status: CloneTrainingStatus | null, progress: number, starting: boolean) {
  if (status === "succeeded") return 100;
  if (starting) return Math.max(3, progress);
  if (status === "queued") return Math.max(6, progress);
  if (status === "running") return Math.max(18, progress);
  if (status === "failed") return Math.max(8, progress);
  return Math.max(0, progress);
}

function toUserFacingError(status: CloneTrainingStatus | null, errorMessage: string | null) {
  if (!errorMessage) return null;
  if (errorMessage.includes(INFRA_AUTO_RETRY_MARKER) && status !== "failed") return null;

  const msg = errorMessage.trim();
  const lower = msg.toLowerCase();

  if (lower.includes("request cancelled") || lower.includes("cancelled")) {
    return "Cloning stopped because the job was cancelled.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "Cloning took too long and was stopped.";
  }
  if (lower.startsWith("{") || lower.includes("worker") || lower.includes("network") || lower.includes("gateway")) {
    return "Temporary server issue. Please try cloning again.";
  }

  return msg;
}
