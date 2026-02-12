"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, CloudUpload, Download, FileAudio, LoaderCircle, PlusCircle, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomAudioPlayer } from "@/components/app/custom-audio-player";
import { DatasetUploader, type DatasetUploaderHandle, type DatasetUploadState } from "@/components/app/dataset-uploader";
import { cn } from "@/lib/utils";

type Voice = { id: string; name: string; language: string | null };

type GenJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  errorMessage?: string | null;
  outputAssetId?: string | null;
};

type QueueItem = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  errorMessage?: string | null;
  createdAt: string;
  voiceName: string;
  inputLabel: string;
  outputAssetId?: string | null;
  outputFileName?: string | null;
};

type UploadPanelState = {
  phase: "idle" | "queued" | "uploading" | "confirming" | "done" | "error" | "cancelled";
  progress: number;
  fileName: string | null;
  fileSize: number | null;
  error: string | null;
};

const AUDIO_ALLOWED_MIME = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/x-flac",
]);

const WAVE_BARS = [
  { id: "b1", height: 26, opacity: 0.45 },
  { id: "b2", height: 40, opacity: 0.57 },
  { id: "b3", height: 70, opacity: 0.69 },
  { id: "b4", height: 86, opacity: 0.82 },
  { id: "b5", height: 61, opacity: 0.58 },
  { id: "b6", height: 32, opacity: 0.45 },
  { id: "b7", height: 52, opacity: 0.62 },
  { id: "b8", height: 79, opacity: 0.77 },
  { id: "b9", height: 91, opacity: 0.88 },
  { id: "b10", height: 43, opacity: 0.56 },
  { id: "b11", height: 21, opacity: 0.42 },
  { id: "b12", height: 57, opacity: 0.66 },
  { id: "b13", height: 81, opacity: 0.79 },
  { id: "b14", height: 50, opacity: 0.6 },
  { id: "b15", height: 22, opacity: 0.42 },
  { id: "b16", height: 35, opacity: 0.51 },
  { id: "b17", height: 68, opacity: 0.74 },
  { id: "b18", height: 88, opacity: 0.87 },
  { id: "b19", height: 61, opacity: 0.64 },
  { id: "b20", height: 33, opacity: 0.5 },
  { id: "b21", height: 25, opacity: 0.45 },
  { id: "b22", height: 49, opacity: 0.58 },
  { id: "b23", height: 77, opacity: 0.75 },
  { id: "b24", height: 84, opacity: 0.84 },
];

export function GenerateForm({
  voices,
  initialVoiceProfileId,
  initialQueue,
}: {
  voices: Voice[];
  initialVoiceProfileId?: string | null;
  initialQueue: QueueItem[];
}) {
  const defaultVoiceId =
    initialVoiceProfileId && voices.some((v) => v.id === initialVoiceProfileId)
      ? initialVoiceProfileId
      : (voices[0]?.id ?? "");

  const [voiceProfileId, setVoiceProfileId] = React.useState<string>(defaultVoiceId);
  const [inputAssetId, setInputAssetId] = React.useState<string | null>(null);
  const [inputFileName, setInputFileName] = React.useState<string | null>(null);
  const [pitch, setPitch] = React.useState(0);
  const [searchFeatureRatio, setSearchFeatureRatio] = React.useState(0.75);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<GenJob | null>(null);
  const [queue, setQueue] = React.useState<QueueItem[]>(initialQueue);
  const [uploadState, setUploadState] = React.useState<UploadPanelState>({
    phase: "idle",
    progress: 0,
    fileName: null,
    fileSize: null,
    error: null,
  });
  const [inputPreviewUrl, setInputPreviewUrl] = React.useState<string | null>(null);
  const [activeResultJobId, setActiveResultJobId] = React.useState<string | null>(
    initialQueue.find((item) => item.status === "succeeded" && item.outputAssetId)?.id ?? null
  );
  const [outputUrl, setOutputUrl] = React.useState<string | null>(null);
  const [outputFileName, setOutputFileName] = React.useState<string | null>(null);
  const [loadingOutput, setLoadingOutput] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [dragState, setDragState] = React.useState<"idle" | "valid" | "invalid">("idle");

  const uploaderRef = React.useRef<DatasetUploaderHandle | null>(null);
  const localPreviewUrlRef = React.useRef<string | null>(null);
  const queueItemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const lastOutputAssetIdRef = React.useRef<string | null>(null);

  const selectedVoice = React.useMemo(() => voices.find((v) => v.id === voiceProfileId) || null, [voiceProfileId, voices]);
  const uploadBusy =
    uploadState.phase === "queued" || uploadState.phase === "uploading" || uploadState.phase === "confirming";

  React.useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
      }
    };
  }, []);

  async function start() {
    if (!voiceProfileId) {
      toast.error("Choose a cloned voice first.");
      return;
    }
    if (uploadBusy) {
      toast.error("Please wait until upload is complete.");
      return;
    }
    if (!inputAssetId) {
      toast.error("Upload a singing record first.");
      return;
    }

    setLoading(true);
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
      toast.error(json?.error?.message || "Could not start conversion.");
      return;
    }

    const nextJobId = String(json.data.jobId);
    setJobId(nextJobId);
    setJob({ id: nextJobId, status: "queued", progress: 0 });
    setQueue((prev) => [
      {
        id: nextJobId,
        status: "queued",
        progress: 0,
        createdAt: new Date().toISOString(),
        voiceName: selectedVoice?.name || "Cloned voice",
        inputLabel: inputFileName || "Singing record",
      },
      ...prev.filter((p) => p.id !== nextJobId),
    ]);
    setOutputUrl(null);
    setOutputFileName(null);
    lastOutputAssetIdRef.current = null;
    toast.success("Conversion started.");
  }

  React.useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const id = jobId;

    async function poll() {
      const res = await fetch(`/api/generate/status?jobId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!alive || !res.ok || !json?.ok) return;

      const next = json.data.job as GenJob;
      setJob(next);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: next.status,
                progress: next.progress,
                errorMessage: next.errorMessage,
                outputAssetId: next.outputAssetId,
              }
            : item
        )
      );
    }

    void poll();
    const t = setInterval(() => void poll(), 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [jobId]);

  const latestSucceeded = React.useMemo(
    () => queue.find((q) => q.status === "succeeded" && !!q.outputAssetId) || null,
    [queue]
  );
  const latestResultJobId =
    job?.status === "succeeded" && job.outputAssetId ? job.id : latestSucceeded?.id || null;
  const activeResultItem = React.useMemo(
    () => queue.find((item) => item.id === activeResultJobId) || null,
    [activeResultJobId, queue]
  );

  const latestOutputAssetId = job?.status === "succeeded" && job.outputAssetId ? job.outputAssetId : latestSucceeded?.outputAssetId || null;

  const fetchOutputUrl = React.useCallback(async (assetId: string, preferredName?: string | null) => {
    setLoadingOutput(true);
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}?json=1`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not load converted audio.");
      }
      const data = json.data as { url: string; fileName?: string };
      setOutputUrl(data.url);
      setOutputFileName(preferredName || data.fileName || "converted.wav");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load converted audio.");
    } finally {
      setLoadingOutput(false);
    }
  }, []);

  React.useEffect(() => {
    if (!latestOutputAssetId) return;
    if (lastOutputAssetIdRef.current === latestOutputAssetId) return;
    lastOutputAssetIdRef.current = latestOutputAssetId;
    if (latestResultJobId) setActiveResultJobId(latestResultJobId);
    void fetchOutputUrl(latestOutputAssetId, latestSucceeded?.outputFileName || null);
  }, [fetchOutputUrl, latestOutputAssetId, latestResultJobId, latestSucceeded?.outputFileName]);

  React.useEffect(() => {
    if (!activeResultJobId) return;
    const el = queueItemRefs.current[activeResultJobId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeResultJobId]);

  async function openQueueResult(item: QueueItem) {
    if (!item.outputAssetId) return;
    setActiveResultJobId(item.id);
    await fetchOutputUrl(item.outputAssetId, item.outputFileName || null);
  }

  const conversionsToday = React.useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    return queue.filter((item) => {
      if (item.status !== "succeeded") return false;
      const t = new Date(item.createdAt);
      return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    }).length;
  }, [queue]);
  const dailyLimit = 50;
  const canCreateCover = !!inputAssetId && !uploadBusy && !loading;

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      <aside className="min-w-0 rounded-2xl border border-white/10 bg-[#11172b]">
        <div className="border-b border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Target Voice
            </h2>
            <Link href="/app/create/new" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              <PlusCircle className="h-3.5 w-3.5" />
              Clone New
            </Link>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
            <div className="rounded-md bg-white/10 px-3 py-1.5 text-center font-semibold">My Clones</div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {voices.map((voice) => {
            const active = voice.id === voiceProfileId;
            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => setVoiceProfileId(voice.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-cyan-400/70 bg-cyan-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-gradient-to-br from-cyan-500/25 to-fuchsia-500/25 font-semibold">
                    {initials(voice.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{voice.name}</div>
                    <div className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {voice.language || "Cloned Voice"}
                    </div>
                  </div>
                  {active ? <CheckCircle2 className="h-4 w-4 text-cyan-300" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 space-y-5">
        <button
          type="button"
          onClick={() => {
            if (uploadBusy) return;
            uploaderRef.current?.openPicker();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const state = draggedAudioState(e.dataTransfer);
            setDragState(state === "invalid" ? "invalid" : "valid");
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const state = draggedAudioState(e.dataTransfer);
            const invalid = state === "invalid";
            e.dataTransfer.dropEffect = invalid ? "none" : "copy";
            setDragState(invalid ? "invalid" : "valid");
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragState("idle");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragState("idle");
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            if (!isValidAudioFile(file)) {
              toast.error("Only wav, mp3, or flac singing records are allowed.");
              return;
            }
            if (uploadBusy) {
              toast.error("Please wait for the current upload to finish.");
              return;
            }
            void uploaderRef.current?.uploadFiles([file]);
          }}
          className={cn(
            "rounded-2xl border-2 border-dashed bg-[#171d33] p-10 text-center transition-colors",
            dragState === "valid" ? "border-cyan-400/70" : dragState === "invalid" ? "border-red-500/60" : "border-white/20",
            dragState === "invalid" || uploadBusy ? "cursor-not-allowed" : "cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
          )}
        >
          <div
            className={cn(
              "mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cyan-500/15 text-cyan-300",
              uploadBusy ? "animate-pulse" : ""
            )}
          >
            {uploadBusy ? <LoaderCircle className="h-7 w-7 animate-spin" /> : <CloudUpload className="h-7 w-7" />}
          </div>
          <h3 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Upload Singing Record
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Drag and drop your singing record here. Allowed formats: WAV, MP3, FLAC.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className={cn("inline-flex h-10 items-center rounded-xl px-7 text-sm font-semibold", uploadBusy ? "border border-white/20 bg-white/5 text-slate-300" : "og-btn-gradient")}>
              {uploadBusy ? "Uploading..." : "Select File"}
            </span>
            <span className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/5 px-7 text-sm font-semibold text-muted-foreground">
              Record Live (Soon)
            </span>
          </div>

          {uploadState.phase !== "idle" ? (
            <div className="mx-auto mt-5 max-w-xl text-left">
              {uploadBusy ? (
                <div className="mb-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      uploaderRef.current?.cancelUpload();
                    }}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel upload
                  </Button>
                </div>
              ) : null}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-400",
                    uploadState.phase === "error" || uploadState.phase === "cancelled"
                      ? "bg-red-400"
                      : uploadState.phase === "done"
                        ? "bg-emerald-400"
                        : "bg-gradient-to-r from-cyan-400 to-fuchsia-400"
                  )}
                  style={{ width: `${Math.max(4, uploadState.progress)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={uploadState.phase === "error" ? "text-red-300" : "text-slate-300"}>
                  {uploadStatusText(uploadState)}
                </span>
                <span className="font-semibold text-cyan-200">{Math.max(0, uploadState.progress)}%</span>
              </div>
            </div>
          ) : null}

          <div className="mt-5 text-xs text-muted-foreground">
            {inputFileName ? `Selected: ${inputFileName}` : "No singing record selected yet."}
          </div>
          {inputAssetId ? <Badge className="mt-3">Singing record ready</Badge> : null}
        </button>

        <DatasetUploader
          ref={uploaderRef}
          type="song_input"
          voiceProfileId={voiceProfileId || undefined}
          ui="minimal"
          hideButton
          hideList
          suppressSuccessToast
          onFileSelected={(file) => {
            setInputAssetId(null);
            setInputFileName(file.name);
            setUploadState({
              phase: "queued",
              progress: 1,
              fileName: file.name,
              fileSize: file.size,
              error: null,
            });
            if (localPreviewUrlRef.current) {
              URL.revokeObjectURL(localPreviewUrlRef.current);
            }
            const nextUrl = URL.createObjectURL(file);
            localPreviewUrlRef.current = nextUrl;
            setInputPreviewUrl(nextUrl);
          }}
          onUploadStateChange={(next: DatasetUploadState) => {
            setUploadState((prev) => ({
              phase: next.phase,
              progress: Math.max(0, Math.min(100, next.progress)),
              fileName: next.fileName || prev.fileName,
              fileSize: next.fileSize ?? prev.fileSize,
              error: next.error || null,
            }));
          }}
          onFilePicked={(name) => setInputFileName(name)}
          onAssetCreated={(id) => {
            setInputAssetId(id);
            setUploadState((prev) => ({
              ...prev,
              phase: "done",
              progress: 100,
              error: null,
            }));
            toast.success("Singing record uploaded.");
          }}
        />

        {uploadState.fileName ? (
          <div className="rounded-2xl border border-white/10 bg-[#171d33] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-500/15 text-cyan-200">
                  <FileAudio className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{uploadState.fileName}</div>
                  <div className="text-xs text-slate-400">{formatFileSize(uploadState.fileSize)}</div>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  uploadBusy
                    ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-200"
                    : uploadState.phase === "done"
                      ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-200"
                    : uploadState.phase === "error"
                        ? "border-red-300/35 bg-red-400/10 text-red-200"
                        : uploadState.phase === "cancelled"
                          ? "border-red-300/35 bg-red-400/10 text-red-200"
                        : "border-white/20 text-slate-300"
                )}
              >
                {uploadBusy
                  ? "Uploading"
                  : uploadState.phase === "done"
                    ? "Ready"
                    : uploadState.phase === "cancelled"
                      ? "Cancelled"
                      : uploadState.phase === "error"
                        ? "Upload failed"
                        : "Selected"}
              </Badge>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                disabled={uploadBusy}
                onClick={() => {
                  uploaderRef.current?.openPicker();
                }}
              >
                Replace file
              </Button>
            </div>

            {inputPreviewUrl ? <CustomAudioPlayer src={inputPreviewUrl} preload="metadata" variant="compact" className="mt-3 w-full" /> : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-[#171d33] p-5">
          <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Voice Style
          </h3>

          <div className="mt-6 grid gap-7 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>Pitch</span>
                <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-300">{pitch > 0 ? `+${pitch}` : pitch}</span>
              </div>
              <input
                type="range"
                min={-24}
                max={24}
                step={1}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <span>-24 lower</span>
                <span>0 natural</span>
                <span>+24 higher</span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>Voice Strength</span>
                <span className="rounded bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-300">
                  {searchFeatureRatio.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={searchFeatureRatio}
                onChange={(e) => setSearchFeatureRatio(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-fuchsia-400"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <span>Natural</span>
                  <span>Balanced</span>
                  <span>Character</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-5">
              <Button
                className={cn(
                  "rounded-xl px-8 disabled:pointer-events-auto disabled:cursor-not-allowed",
                  canCreateCover
                    ? "og-btn-gradient cursor-pointer"
                    : "border border-white/15 bg-white/10 text-slate-400 cursor-not-allowed"
                )}
                onClick={() => void start()}
                disabled={!canCreateCover}
              >
                {loading ? "Starting..." : "Create Cover"}
              </Button>
            </div>

          {job?.status === "failed" ? <div className="mt-4 text-sm text-red-300">{job.errorMessage || "Conversion failed."}</div> : null}
        </div>
      </section>

      <aside className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#11172b]">
        <div className="border-b border-white/10 p-5">
          <h3 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Latest Result
          </h3>
          {activeResultItem ? (
            <div className="mt-2 inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
              Now playing from queue
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-xl bg-[#0e1733] p-4">
            <div className="mb-4 flex h-16 items-end gap-1">
              {WAVE_BARS.map((bar) => (
                <span
                  key={bar.id}
                  className="w-full rounded-full bg-cyan-400/70"
                  style={{ height: `${bar.height}%`, opacity: bar.opacity }}
                />
              ))}
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{outputFileName || "No result yet"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {activeResultItem?.voiceName || selectedVoice?.name || "Cloned voice"}
                  </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  disabled={!outputUrl || loadingOutput}
                  onClick={() => {
                    if (!latestOutputAssetId) return;
                    void fetchOutputUrl(latestOutputAssetId, latestSucceeded?.outputFileName || null);
                  }}
                  title="Refresh audio link"
                >
                  <CloudUpload className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  disabled={!outputUrl}
                  onClick={() => {
                    if (!outputUrl) return;
                    navigator.clipboard.writeText(outputUrl).then(() => {
                      toast.success("Link copied.");
                    }).catch(() => {
                      toast.error("Could not copy link.");
                    });
                  }}
                  title="Copy link"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <CustomAudioPlayer
              src={outputUrl || null}
              preload="none"
              className="mt-3 w-full"
            />

            {outputUrl ? (
              <Button asChild className="og-btn-gradient mt-3 w-full rounded-xl">
                <Link href={outputUrl} target="_blank" download={outputFileName || "converted.wav"}>
                  <Download className="mr-2 h-4 w-4" />
                  Download latest
                </Link>
              </Button>
            ) : (
              <Button className="mt-3 w-full rounded-xl" disabled>
                <Download className="mr-2 h-4 w-4" />
                Download latest
              </Button>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
              <h3 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
                Recent Jobs
              </h3>
            <Badge variant="secondary">{queue.filter((q) => q.status === "queued" || q.status === "running").length} pending</Badge>
          </div>

          <div className="space-y-3">
            {queue.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                No conversion started yet.
              </div>
            ) : (
              queue.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  ref={(el) => {
                    queueItemRefs.current[item.id] = el;
                  }}
                  className={cn(
                    "rounded-xl border p-4",
                    item.status === "running"
                      ? "border-cyan-400/40 bg-cyan-500/10"
                      : item.status === "queued"
                        ? "border-white/15 bg-white/5"
                        : item.status === "succeeded"
                          ? "border-emerald-400/30 bg-emerald-500/10"
                          : "border-red-500/30 bg-red-500/10",
                    activeResultJobId === item.id ? "ring-1 ring-cyan-300/60" : ""
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.inputLabel}</div>
                      <div className="truncate text-[11px] text-muted-foreground">Target: {item.voiceName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeResultJobId === item.id ? (
                        <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-200">
                          Selected
                        </span>
                      ) : null}
                      <span className="text-xs font-semibold text-muted-foreground">{queueStatusLabel(item.status)}</span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        item.status === "failed"
                          ? "bg-red-400"
                          : item.status === "succeeded"
                            ? "bg-emerald-400"
                            : "bg-gradient-to-r from-cyan-400 to-fuchsia-400"
                      )}
                      style={{ width: `${Math.max(4, item.progress)}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{formatAgo(item.createdAt)}</span>
                    <span>{item.progress}%</span>
                  </div>

                  {item.status === "succeeded" && item.outputAssetId ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md text-[11px]"
                        onClick={() => {
                          void openQueueResult(item);
                        }}
                      >
                        Open result
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/5 p-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Daily Generation Limit</span>
            <span className="font-semibold text-cyan-300">
              {Math.min(dailyLimit, conversionsToday)} / {dailyLimit}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
              style={{ width: `${Math.min(100, (Math.min(dailyLimit, conversionsToday) / dailyLimit) * 100)}%` }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function queueStatusLabel(status: QueueItem["status"]) {
  if (status === "queued") return "Waiting";
  if (status === "running") return "Converting";
  if (status === "succeeded") return "Done";
  return "Stopped";
}

function initials(name: string) {
  const chunks = name.trim().split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return "VC";
  if (chunks.length === 1) return chunks[0]!.slice(0, 2).toUpperCase();
  return `${chunks[0]![0] || ""}${chunks[1]![0] || ""}`.toUpperCase();
}

function isValidAudioFile(file: File) {
  const lower = file.name.toLowerCase();
  const extOkay = lower.endsWith(".wav") || lower.endsWith(".mp3") || lower.endsWith(".flac");
  if (!extOkay) return false;
  if (!file.type) return true;
  return AUDIO_ALLOWED_MIME.has(file.type.toLowerCase());
}

function draggedAudioState(dt: DataTransfer): "valid" | "invalid" | "unknown" {
  const items = Array.from(dt.items || []);
  const fileItems = items.filter((item) => item.kind === "file");
  if (fileItems.length === 0) return "unknown";

  let sawValid = false;
  for (const item of fileItems) {
    const t = (item.type || "").toLowerCase();
    if (!t) continue;
    if (!AUDIO_ALLOWED_MIME.has(t)) return "invalid";
    sawValid = true;
  }
  return sawValid ? "valid" : "unknown";
}

function formatAgo(iso: string) {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.floor((now - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function uploadStatusText(state: UploadPanelState) {
  if (state.phase === "queued") return "Preparing upload...";
  if (state.phase === "uploading") return "Uploading singing record...";
  if (state.phase === "confirming") return "Finalizing file...";
  if (state.phase === "done") return "Upload complete.";
  if (state.phase === "cancelled") return "Upload cancelled.";
  if (state.phase === "error") return state.error || "Upload failed.";
  return "";
}

function formatFileSize(size: number | null) {
  if (!size || size <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
