"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Download,
  FileAudio,
  LoaderCircle,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type LibraryItem = {
  jobId: string;
  assetId: string;
  fileName: string;
  voiceId: string;
  voiceName: string;
  createdAt: string;
};

export function MyLibraryPanel({
  initialItems,
  initialAutoPlayAssetId,
}: {
  initialItems: LibraryItem[];
  initialAutoPlayAssetId?: string | null;
}) {
  const [items, setItems] = React.useState<LibraryItem[]>(initialItems);
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(null);
  const [editingFileName, setEditingFileName] = React.useState("");
  const [savingAssetId, setSavingAssetId] = React.useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = React.useState<string | null>(null);
  const [playingAssetId, setPlayingAssetId] = React.useState<string | null>(null);
  const [loadingPlayAssetId, setLoadingPlayAssetId] = React.useState<string | null>(null);
  const [assetUrls, setAssetUrls] = React.useState<Record<string, string>>({});
  const [focusedAssetId, setFocusedAssetId] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const autoPlayAttemptedRef = React.useRef<string | null>(null);
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map());

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlayingAssetId(null);
    const onPause = () => {
      if (audio.ended) return;
      if (audio.currentTime > 0 && audio.paused) {
        setPlayingAssetId(null);
      }
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  function beginRename(item: LibraryItem) {
    setEditingAssetId(item.assetId);
    setEditingFileName(item.fileName);
  }

  function cancelRename() {
    setEditingAssetId(null);
    setEditingFileName("");
  }

  async function saveRename(assetId: string) {
    const nextName = editingFileName.trim();
    if (!nextName) {
      toast.error("File name cannot be empty.");
      return;
    }

    setSavingAssetId(assetId);
    try {
      const res = await fetch("/api/generate/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, fileName: nextName }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not rename file.");
      }

      const updatedName = String(json.data.fileName || nextName);
      setItems((prev) => prev.map((item) => (item.assetId === assetId ? { ...item, fileName: updatedName } : item)));
      setEditingAssetId(null);
      setEditingFileName("");
      toast.success("File name updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename file.");
    } finally {
      setSavingAssetId(null);
    }
  }

  async function deleteOne(item: LibraryItem) {
    const confirmed = window.confirm(`Delete \"${item.fileName}\" from your library?`);
    if (!confirmed) return;

    setDeletingAssetId(item.assetId);
    try {
      const res = await fetch("/api/generate/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: item.assetId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not delete file.");
      }

      if (playingAssetId === item.assetId && audioRef.current) {
        audioRef.current.pause();
        setPlayingAssetId(null);
      }

      setItems((prev) => prev.filter((x) => x.assetId !== item.assetId));
      if (editingAssetId === item.assetId) {
        setEditingAssetId(null);
        setEditingFileName("");
      }
      toast.success("File removed from library.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete file.");
    } finally {
      setDeletingAssetId(null);
    }
  }

  const playFromUrl = React.useCallback(async (assetId: string, url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = url;
    try {
      await audio.play();
      setPlayingAssetId(assetId);
    } catch {
      toast.error("Could not play track.");
      setPlayingAssetId(null);
    }
  }, []);

  const togglePlay = React.useCallback(
    async (item: LibraryItem) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (playingAssetId === item.assetId && !audio.paused) {
        audio.pause();
        setPlayingAssetId(null);
        return;
      }

      const knownUrl = assetUrls[item.assetId];
      if (knownUrl) {
        await playFromUrl(item.assetId, knownUrl);
        return;
      }

      setLoadingPlayAssetId(item.assetId);
      try {
        const res = await fetch(`/api/assets/${encodeURIComponent(item.assetId)}?json=1`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message || "Could not load track.");
        }
        const url = String(json.data.url || "");
        if (!url) throw new Error("Could not load track.");
        setAssetUrls((prev) => ({ ...prev, [item.assetId]: url }));
        await playFromUrl(item.assetId, url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load track.");
      } finally {
        setLoadingPlayAssetId(null);
      }
    },
    [assetUrls, playFromUrl, playingAssetId]
  );

  React.useEffect(() => {
    const targetAssetId = (initialAutoPlayAssetId || "").trim();
    if (!targetAssetId) return;
    if (autoPlayAttemptedRef.current === targetAssetId) return;

    const item = items.find((x) => x.assetId === targetAssetId);
    if (!item) return;

    autoPlayAttemptedRef.current = targetAssetId;
    setFocusedAssetId(targetAssetId);
    const cardEl = itemRefs.current.get(targetAssetId);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    void togglePlay(item);
  }, [initialAutoPlayAssetId, items, togglePlay]);

  React.useEffect(() => {
    if (!focusedAssetId) return;
    const t = window.setTimeout(() => setFocusedAssetId(null), 1800);
    return () => window.clearTimeout(t);
  }, [focusedAssetId]);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#101a35] p-4 md:p-5">
      <audio ref={audioRef} preload="none" className="hidden">
        <track kind="captions" srcLang="en" label="captions" src="data:text/vtt,WEBVTT" />
      </audio>

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-300">Your generated tracks in a music-library view.</p>
        <Badge variant="secondary" className="bg-white/10 text-slate-100">{items.length} tracks</Badge>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No tracks in your library yet. Create a cover to see it here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => {
            const isEditing = editingAssetId === item.assetId;
            const busy = savingAssetId === item.assetId || deletingAssetId === item.assetId;
            const loadingPlay = loadingPlayAssetId === item.assetId;
            const playing = playingAssetId === item.assetId;
            return (
              <article
                key={item.assetId}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.assetId, el);
                  else itemRefs.current.delete(item.assetId);
                }}
                className={
                  "relative flex min-h-[360px] flex-col overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-3 transition-colors " +
                  (focusedAssetId === item.assetId
                    ? "border-cyan-300/60 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                    : "border-white/10")
                }
              >
                <div className="relative overflow-hidden rounded-xl border border-white/10">
                  <VoiceLibraryCover voiceId={item.voiceId} alt={item.voiceName} />
                </div>

                <div className="mt-3 flex min-h-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-lg font-semibold leading-tight text-slate-100">{item.fileName}</div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                          disabled={busy}
                          aria-label="Track actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onSelect={() => beginRename(item)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/api/assets/${encodeURIComponent(item.assetId)}`} target="_blank">
                            <Download className="h-4 w-4" />
                            Download
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            void deleteOne(item);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {isEditing ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        className="h-8 border-white/15 bg-white/5 text-slate-100"
                        maxLength={180}
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8 rounded-lg cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                        disabled={busy}
                        onClick={() => void saveRename(item.assetId)}
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                        disabled={busy}
                        onClick={cancelRename}
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-2 text-sm text-slate-200">{item.voiceName}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatCreated(item.createdAt)}</div>

                  <div className="mt-auto pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        void togglePlay(item);
                      }}
                      className={
                        "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors " +
                        (playing
                          ? "border-fuchsia-300/45 bg-fuchsia-500/20 text-fuchsia-100"
                          : "border-cyan-300/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/22") +
                        " cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                      }
                      disabled={busy || loadingPlay}
                      aria-label={playing ? "Pause" : "Play"}
                    >
                      {loadingPlay ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                      ) : playing ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VoiceLibraryCover({ voiceId, alt }: { voiceId: string; alt: string }) {
  const [ok, setOk] = React.useState(true);
  const src = `/api/voices/${encodeURIComponent(voiceId)}/cover`;

  if (!ok) {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 text-slate-200">
        <FileAudio className="h-8 w-8" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="aspect-[3/4] w-full object-cover"
      onError={() => setOk(false)}
    />
  );
}

function formatCreated(iso: string) {
  return new Date(iso).toLocaleString();
}
