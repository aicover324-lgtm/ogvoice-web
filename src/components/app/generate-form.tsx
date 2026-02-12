"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatasetUploader } from "@/components/app/dataset-uploader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type Voice = { id: string; name: string; language: string | null };
type GenJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  errorMessage?: string | null;
  outputAssetId?: string | null;
};

export function GenerateForm({
  voices,
  initialVoiceProfileId,
}: {
  voices: Voice[];
  initialVoiceProfileId?: string | null;
}) {
  const defaultVoiceId =
    initialVoiceProfileId && voices.some((v) => v.id === initialVoiceProfileId)
      ? initialVoiceProfileId
      : (voices[0]?.id ?? "");

  const [voiceProfileId, setVoiceProfileId] = React.useState<string>(defaultVoiceId);
  const [inputAssetId, setInputAssetId] = React.useState<string | null>(null);
  const [pitch, setPitch] = React.useState(0);
  const [searchFeatureRatio, setSearchFeatureRatio] = React.useState(0.75);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<GenJob | null>(null);
  const [outputUrl, setOutputUrl] = React.useState<string | null>(null);
  const [outputFileName, setOutputFileName] = React.useState<string | null>(null);
  const [loadingOutput, setLoadingOutput] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const lastOutputAssetIdRef = React.useRef<string | null>(null);

  async function start() {
    if (!voiceProfileId) {
      toast.error("Select a cloned voice first.");
      return;
    }
    if (!inputAssetId) {
      toast.error("Upload a singing record first.");
      return;
    }

    setLoading(true);
    setOutputUrl(null);
    setOutputFileName(null);
    lastOutputAssetIdRef.current = null;
    const res = await fetch("/api/generate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceProfileId,
        inputAssetId,
        pitch,
        searchFeatureRatio,
      }),
    });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Could not start voice conversion.");
      return;
    }
    setJobId(json.data.jobId);
    toast.success("Voice conversion started.");
  }

  React.useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const id = jobId;
    async function poll() {
      const res = await fetch(`/api/generate/status?jobId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!alive) return;
      if (res.ok && json?.ok) setJob(json.data.job as GenJob);
    }
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [jobId]);

  const fetchOutputUrl = React.useCallback(async (assetId: string) => {
    setLoadingOutput(true);
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}?json=1`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not load converted audio.");
      }
      const data = json.data as { url: string; fileName?: string };
      setOutputUrl(data.url);
      setOutputFileName(data.fileName || "converted.wav");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load converted audio.");
    } finally {
      setLoadingOutput(false);
    }
  }, []);

  React.useEffect(() => {
    const outputAssetId = job?.outputAssetId || null;
    if (!outputAssetId || job?.status !== "succeeded") return;
    if (lastOutputAssetIdRef.current === outputAssetId && outputUrl) return;
    lastOutputAssetIdRef.current = outputAssetId;
    void fetchOutputUrl(outputAssetId);
  }, [fetchOutputUrl, job?.outputAssetId, job?.status, outputUrl]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card className="p-6">
        <div className="text-sm font-semibold">1) Choose Cloned Voice</div>
        <div className="mt-3 grid gap-2">
          <Label>Cloned voice</Label>
          <Select value={voiceProfileId} onValueChange={setVoiceProfileId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a cloned voice" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}{v.language ? ` (${v.language})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 text-sm font-semibold">2) Upload Singing Record</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Upload a clean vocal audio file. We will use this for voice conversion.
        </div>
        <div className="mt-3 grid gap-3">
          <DatasetUploader
            type="song_input"
            voiceProfileId={voiceProfileId || undefined}
            onAssetCreated={(id) => {
              setInputAssetId(id);
            }}
          />
        </div>
      </Card>

      <Card className="p-6">
        <div>
          <div className="text-sm font-semibold">3) Voice Style</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Split audio is always on. Extra effects stay off for a clean result.
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Pitch</Label>
              <span className="text-xs text-muted-foreground">{pitch}</span>
            </div>
            <input
              type="range"
              min={-24}
              max={24}
              step={1}
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary"
            />
            <div className="text-xs text-muted-foreground">Lower values sound deeper, higher values sound brighter.</div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Search Feature Ratio</Label>
              <span className="text-xs text-muted-foreground">{searchFeatureRatio.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={searchFeatureRatio}
              onChange={(e) => setSearchFeatureRatio(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary"
            />
            <div className="text-xs text-muted-foreground">
              Higher values keep the cloned voice tone stronger. Lower values keep more of the original singing style.
            </div>
          </div>

          <Button className="mt-1 rounded-full cursor-pointer" onClick={start} disabled={loading}>
            {loading ? "Starting..." : "Convert"}
          </Button>
        </div>

        <div className="mt-6 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Status</div>
            <Badge variant="secondary">{toStatusLabel(job?.status || null)}</Badge>
          </div>
          <div className="mt-3">
            <Progress value={job?.progress ?? 0} />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{jobId ? `Session: ${jobId}` : "No conversion yet"}</span>
              <span>{job?.progress ?? 0}%</span>
            </div>
          </div>
          <div className="mt-4 text-sm">
            {job?.status === "succeeded" ? (
              <div>Conversion finished. We will add output playback in the next step.</div>
            ) : job?.status === "failed" ? (
              <div className="text-destructive">{job.errorMessage || "Voice conversion failed."}</div>
            ) : (
              <div className="text-muted-foreground">Start conversion to see progress here.</div>
            )}
          </div>

          {job?.status === "succeeded" ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-black/10 bg-background/40 p-3 dark:border-white/10">
              <div className="text-xs text-muted-foreground">Converted Audio</div>
              <audio
                controls
                preload="none"
                src={outputUrl || undefined}
                className="w-full"
              >
                <track kind="captions" srcLang="en" label="captions" src="data:text/vtt,WEBVTT" />
              </audio>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full cursor-pointer"
                  disabled={!job.outputAssetId || loadingOutput}
                  onClick={() => {
                    if (!job.outputAssetId) return;
                    void fetchOutputUrl(job.outputAssetId);
                  }}
                >
                  {loadingOutput ? "Refreshing..." : "Refresh Player Link"}
                </Button>
                <Button
                  asChild
                  className="rounded-full cursor-pointer"
                  disabled={!outputUrl}
                >
                  <Link href={outputUrl || "#"} target="_blank">
                    Download Audio
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full cursor-pointer"
                  disabled={!outputUrl}
                >
                  <Link href={outputUrl || "#"} target="_blank">
                    Open In New Tab
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full cursor-pointer"
                  disabled={!job.outputAssetId}
                  onClick={() => {
                    toast.success("Converted audio is already saved to your library.");
                  }}
                >
                  Save To Library
                </Button>
                {outputFileName ? <span className="text-xs text-muted-foreground">{outputFileName}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function toStatusLabel(status: GenJob["status"] | null) {
  if (status === "queued") return "Preparing";
  if (status === "running") return "Converting";
  if (status === "succeeded") return "Done";
  if (status === "failed") return "Failed";
  return "Idle";
}
