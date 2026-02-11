"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatasetUploader } from "@/components/app/dataset-uploader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type Voice = { id: string; name: string; language: string | null };
type GenJob = { id: string; status: "queued" | "running" | "succeeded" | "failed"; progress: number };

const NO_DEMO = "__none__";

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
  const [demoTrackId, setDemoTrackId] = React.useState<string>(NO_DEMO);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<GenJob | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function start() {
    if (!voiceProfileId) {
      toast.error("Select a voice");
      return;
    }
    if (!inputAssetId && demoTrackId === NO_DEMO) {
      toast.error("Upload an input audio file or choose a demo track.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/generate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceProfileId,
        inputAssetId: inputAssetId || undefined,
        demoTrackId: demoTrackId === NO_DEMO ? undefined : demoTrackId,
      }),
    });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Failed to start generation");
      return;
    }
    setJobId(json.data.jobId);
    toast.success("Generation started (placeholder)");
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

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-6">
        <div className="text-sm font-semibold">1) Choose voice</div>
        <div className="mt-3 grid gap-2">
          <Label>Voice profile</Label>
          <Select value={voiceProfileId} onValueChange={setVoiceProfileId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a voice" />
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

        <div className="mt-6 text-sm font-semibold">2) Provide a track</div>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2">
            <Label>Demo track (optional)</Label>
            <Select
              value={demoTrackId}
              onValueChange={(v) => {
                setDemoTrackId(v);
                if (v !== NO_DEMO) setInputAssetId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a demo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEMO}>None</SelectItem>
                <SelectItem value="demo_pop_01">Demo Pop 01 (placeholder)</SelectItem>
                <SelectItem value="demo_ballad_01">Demo Ballad 01 (placeholder)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">Or upload your own audio (stored as `song_input`).</div>
            <DatasetUploader
              type="song_input"
              onAssetCreated={(id) => {
                setInputAssetId(id);
                setDemoTrackId(NO_DEMO);
              }}
            />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">3) Generate (placeholder)</div>
            <div className="mt-1 text-xs text-muted-foreground">
              The backend endpoints exist; output is a stub for now.
            </div>
          </div>
          <Button className="rounded-full" onClick={start} disabled={loading}>
            {loading ? "Starting..." : "Generate"}
          </Button>
        </div>

        <div className="mt-6 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Status</div>
            <Badge variant="secondary">{job?.status || "idle"}</Badge>
          </div>
          <div className="mt-3">
            <Progress value={job?.progress ?? 0} />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{jobId ? `job: ${jobId}` : "No job"}</span>
              <span>{job?.progress ?? 0}%</span>
            </div>
          </div>
          <div className="mt-4 text-sm">
            {job?.status === "succeeded" ? (
              <div>
                Output is a placeholder in this MVP. When ML is integrated, this will link to a generated audio asset.
              </div>
            ) : (
              <div className="text-muted-foreground">Start generation to see progress and results here.</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
