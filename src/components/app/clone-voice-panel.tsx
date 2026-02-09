"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type JobStatus = "queued" | "running" | "succeeded" | "failed";

export function CloneVoicePanel({
  voiceProfileId,
  hasDataset,
}: {
  voiceProfileId: string;
  hasDataset: boolean;
}) {
  const router = useRouter();
  const [starting, setStarting] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<JobStatus | null>(null);
  const [artifactKey, setArtifactKey] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number>(0);
  const lastStatusRef = React.useRef<JobStatus | null>(null);

  const refresh = React.useCallback(async (nextJobId: string) => {
    const res = await fetch(`/api/training/status?jobId=${encodeURIComponent(nextJobId)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return;
    }
    const j = json.data.job as {
      status: JobStatus;
      progress?: number;
      artifactKey?: string | null;
      errorMessage?: string | null;
    };
    setStatus(j.status);
    setProgress(typeof j.progress === "number" ? j.progress : 0);
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
    const t = setInterval(() => void refresh(jobId), 6000);
    return () => clearInterval(t);
  }, [jobId, refresh]);

  async function start() {
    if (!hasDataset) {
      toast.error("Upload a dataset file first.");
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
      toast.success("Training started");
      await refresh(nextJobId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start training");
    } finally {
      setStarting(false);
    }
  }

  const inFlight = status === "running" || status === "queued";
  const canStart = hasDataset && !starting && !inFlight;

  const label = starting
    ? "Starting..."
    : inFlight
      ? "Training..."
      : status === "succeeded"
        ? "Trained"
        : status === "failed"
          ? "Try again"
          : "Clone AI Voice";

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

  return (
    <div className="grid gap-2">
      <Button type="button" className="rounded-full" onClick={() => void start()} disabled={!canStart}>
        {label}
      </Button>
      {jobId ? <div className="text-xs text-muted-foreground">Job: {jobId.slice(0, 12)}</div> : null}
      {statusText ? <div className="text-xs text-muted-foreground">Status: {statusText}</div> : null}
      {inFlight ? (
        <div className="mt-1">
          <Progress value={Math.max(5, Math.min(99, progress || 0))} />
        </div>
      ) : null}
      {errorMessage ? <div className="text-xs text-destructive">{errorMessage}</div> : null}
      {artifactKey && status === "succeeded" ? (
        <div className="text-xs text-muted-foreground">Model is ready. It appears in “Model versions”.</div>
      ) : null}
    </div>
  );
}
