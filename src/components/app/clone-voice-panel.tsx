"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  initialArtifactKey,
  initialErrorMessage,
}: {
  voiceProfileId: string;
  hasDataset: boolean;
  compact?: boolean;
  onVisualStateChange?: (state: ClonePanelVisualState) => void;
  initialJobId?: string | null;
  initialStatus?: CloneTrainingStatus | null;
  initialArtifactKey?: string | null;
  initialErrorMessage?: string | null;
}) {
  const router = useRouter();
  const [starting, setStarting] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(initialJobId ?? null);
  const [status, setStatus] = React.useState<CloneTrainingStatus | null>(initialStatus ?? null);
  const [artifactKey, setArtifactKey] = React.useState<string | null>(initialArtifactKey ?? null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(initialErrorMessage ?? null);
  const lastStatusRef = React.useRef<CloneTrainingStatus | null>(initialStatus ?? null);
  const successNotifiedRef = React.useRef(initialStatus === "succeeded");
  const failedNotifiedRef = React.useRef(initialStatus === "failed");
  const retryNotifiedRef = React.useRef(false);

  React.useEffect(() => {
    setJobId(initialJobId ?? null);
    setStatus(initialStatus ?? null);
    setArtifactKey(initialArtifactKey ?? null);
    setErrorMessage(initialErrorMessage ?? null);
    lastStatusRef.current = initialStatus ?? null;
    successNotifiedRef.current = initialStatus === "succeeded";
    failedNotifiedRef.current = initialStatus === "failed";
    retryNotifiedRef.current = false;
  }, [initialArtifactKey, initialErrorMessage, initialJobId, initialStatus]);

  const refresh = React.useCallback(async (nextJobId: string) => {
    const res = await fetch(`/api/training/status?jobId=${encodeURIComponent(nextJobId)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return;
    }
    const j = json.data.job as {
      status: CloneTrainingStatus;
      artifactKey?: string | null;
      errorMessage?: string | null;
    };
    setStatus(j.status);
    setArtifactKey(j.artifactKey ?? null);
    setErrorMessage(j.errorMessage ?? null);

    if (j.status === "succeeded" && lastStatusRef.current !== "succeeded") {
      // Pull new versions into the server component list.
      router.refresh();
    }
    lastStatusRef.current = j.status;
  }, [router]);

  React.useEffect(() => {
    if (!jobId) return;
    if (status === "succeeded" || status === "failed") return;
    const t = setInterval(() => void refresh(jobId), 6000);
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
      toast.success("Voice successfully cloned !");
      successNotifiedRef.current = true;
      failedNotifiedRef.current = false;
      return;
    }
    if (status === "failed" && !failedNotifiedRef.current) {
      toast.error("Voice cloning failed");
      failedNotifiedRef.current = true;
      successNotifiedRef.current = false;
      return;
    }
    if (status !== "succeeded") {
      successNotifiedRef.current = false;
    }
    if (status !== "failed") {
      failedNotifiedRef.current = false;
    }
  }, [status]);

  const autoRetryActive =
    (status === "queued" || status === "running") && !!errorMessage?.includes(INFRA_AUTO_RETRY_MARKER);

  React.useEffect(() => {
    if (autoRetryActive && !retryNotifiedRef.current) {
      toast.message("Temporary server issue detected. Retrying automatically...");
      retryNotifiedRef.current = true;
      return;
    }
    if (!autoRetryActive) {
      retryNotifiedRef.current = false;
    }
  }, [autoRetryActive]);

  async function start() {
    if (!hasDataset) {
      toast.error("Upload your singing voice recording first.");
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
      toast.success("Training started");
      await refresh(nextJobId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start training");
    } finally {
      setStarting(false);
    }
  }

  const canStart = hasDataset && !starting && !inFlight && status !== "succeeded";

  const label = starting
    ? "Starting..."
    : inFlight
      ? "Cloning..."
      : status === "succeeded"
        ? "Voice successfully cloned !"
        : status === "failed"
          ? "Re-clone Voice"
          : "Clone Voice";

  const statusText =
    status === "queued"
      ? "Queued (waiting for GPU)"
      : status === "running"
        ? "Training"
        : status === "succeeded"
          ? "Completed"
          : status === "failed"
            ? "Failed"
            : null;

  const inlineInfo = autoRetryActive
    ? "Temporary server issue detected. We are retrying automatically."
    : null;

  const inlineError = toUserFacingError(status, errorMessage);

  return (
    <div className="grid gap-2">
      {status === "succeeded" ? (
        <div className="flex h-9 items-center justify-center rounded-full border border-fuchsia-500/35 bg-fuchsia-500/10 px-4 text-sm font-semibold text-fuchsia-500 dark:border-fuchsia-400/45 dark:bg-fuchsia-500/15 dark:text-fuchsia-300">
          {label}
        </div>
      ) : (
        <Button
          type="button"
          className="rounded-full cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
          onClick={() => void start()}
          disabled={!canStart}
        >
          {label}
        </Button>
      )}
      {compact ? null : jobId ? <div className="text-xs text-muted-foreground">Job: {jobId.slice(0, 12)}</div> : null}
      {!compact && statusText ? <div className="text-xs text-muted-foreground">Status: {statusText}</div> : null}
      {inlineInfo ? <div className="text-xs text-muted-foreground">{inlineInfo}</div> : null}
      {inlineError ? <div className="text-xs text-destructive">{inlineError}</div> : null}
      {!compact && artifactKey && status === "succeeded" ? (
        <div className="text-xs text-muted-foreground">Model is ready. It appears in “Model versions”.</div>
      ) : null}
    </div>
  );
}

function toUserFacingError(status: CloneTrainingStatus | null, errorMessage: string | null) {
  if (!errorMessage) return null;
  if (errorMessage.includes(INFRA_AUTO_RETRY_MARKER) && status !== "failed") return null;

  const msg = errorMessage.trim();
  const lower = msg.toLowerCase();

  if (lower.includes("request cancelled") || lower.includes("cancelled")) {
    return "Voice cloning failed because the job was cancelled.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "Voice cloning failed because the training timed out.";
  }
  if (lower.startsWith("{") || lower.includes("worker") || lower.includes("network") || lower.includes("gateway")) {
    return "Voice cloning failed due to a temporary server issue. Please try again.";
  }

  return msg;
}
