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
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Star,
  Trash2,
  Volume2,
  VolumeX,
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
  isFavorite: boolean;
  voiceId: string;
  voiceName: string;
  createdAt: string;
};

type DateFilter = "all" | "7d" | "30d" | "90d";
type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type TabKey = "all" | "favorites";
type RepeatMode = "off" | "all" | "one";

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
  const [batchDeleting, setBatchDeleting] = React.useState(false);
  const [playingAssetId, setPlayingAssetId] = React.useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = React.useState<string | null>(null);
  const [shuffleEnabled, setShuffleEnabled] = React.useState(false);
  const [repeatMode, setRepeatMode] = React.useState<RepeatMode>("off");
  const [endedTick, setEndedTick] = React.useState(0);
  const [loadingPlayAssetId, setLoadingPlayAssetId] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(0.9);
  const [muted, setMuted] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [assetUrls, setAssetUrls] = React.useState<Record<string, string>>({});
  const [focusedAssetId, setFocusedAssetId] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<TabKey>("all");
  const [query, setQuery] = React.useState("");
  const [voiceFilter, setVoiceFilter] = React.useState<string>("all");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [sortBy, setSortBy] = React.useState<SortKey>("newest");

  const [favoriteAssetIds, setFavoriteAssetIds] = React.useState<Set<string>>(
    new Set(initialItems.filter((item) => item.isFavorite).map((item) => item.assetId))
  );
  const [favoritingAssetIds, setFavoritingAssetIds] = React.useState<Set<string>>(new Set());
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(new Set());
  const favoriteAssetIdsRef = React.useRef(favoriteAssetIds);
  const activeAssetIdRef = React.useRef<string | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const autoPlayAttemptedRef = React.useRef<string | null>(null);
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map());

  React.useEffect(() => {
    favoriteAssetIdsRef.current = favoriteAssetIds;
  }, [favoriteAssetIds]);

  React.useEffect(() => {
    activeAssetIdRef.current = activeAssetId;
  }, [activeAssetId]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.9;
    audio.playbackRate = 1;

    const onLoaded = () => {
      setDuration(resolveDuration(audio));
      setCurrentTime(audio.currentTime || 0);
    };
    const onTime = () => {
      setCurrentTime(audio.currentTime || 0);
      const d = resolveDuration(audio);
      if (d > 0) setDuration(d);
    };
    const onPlay = () => {
      const currentId = activeAssetIdRef.current;
      if (currentId) setPlayingAssetId(currentId);
    };
    const onPause = () => {
      if (audio.ended) return;
      setPlayingAssetId(null);
    };
    const onEnded = () => {
      setPlayingAssetId(null);
      setCurrentTime(resolveDuration(audio));
      setEndedTick((n) => n + 1);
    };
    const onVolume = () => {
      setMuted(audio.muted);
      setVolume(audio.volume);
    };
    const onRate = () => {
      setPlaybackRate(audio.playbackRate || 1);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("loadeddata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("volumechange", onVolume);
    audio.addEventListener("ratechange", onRate);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("loadeddata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("volumechange", onVolume);
      audio.removeEventListener("ratechange", onRate);
    };
  }, []);

  const voiceOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const item of items) {
      if (!byId.has(item.voiceId)) byId.set(item.voiceId, item.voiceName);
    }
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const visibleItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = items.filter((item) => {
      if (tab === "favorites" && !favoriteAssetIds.has(item.assetId)) return false;
      if (voiceFilter !== "all" && item.voiceId !== voiceFilter) return false;
      if (!matchesDateFilter(item.createdAt, dateFilter)) return false;
      if (!q) return true;
      return item.fileName.toLowerCase().includes(q) || item.voiceName.toLowerCase().includes(q);
    });

    next = next.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "name_asc") return a.fileName.localeCompare(b.fileName);
      return b.fileName.localeCompare(a.fileName);
    });

    return next;
  }, [dateFilter, favoriteAssetIds, items, query, sortBy, tab, voiceFilter]);

  const activeItem = React.useMemo(() => {
    const id = activeAssetId || playingAssetId;
    if (!id) return null;
    return items.find((item) => item.assetId === id) || null;
  }, [activeAssetId, items, playingAssetId]);

  const playQueueItems = React.useMemo(() => {
    return visibleItems.length > 0 ? visibleItems : items;
  }, [items, visibleItems]);

  const activeQueueIndex = React.useMemo(() => {
    if (!activeItem) return -1;
    return playQueueItems.findIndex((item) => item.assetId === activeItem.assetId);
  }, [activeItem, playQueueItems]);

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedAssetIds.has(item.assetId));

  const favoriteCount = React.useMemo(
    () => items.filter((item) => favoriteAssetIds.has(item.assetId)).length,
    [favoriteAssetIds, items]
  );

  function beginRename(item: LibraryItem) {
    setEditingAssetId(item.assetId);
    setEditingFileName(item.fileName);
  }

  function cancelRename() {
    setEditingAssetId(null);
    setEditingFileName("");
  }

  async function applyFavorite(assetId: string, nextFavorite: boolean, opts?: { showUndo?: boolean }) {
    const showUndo = opts?.showUndo !== false;
    const wasFavorite = favoriteAssetIdsRef.current.has(assetId);
    if (wasFavorite === nextFavorite) return;

    setFavoritingAssetIds((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });

    setFavoriteAssetIds((prev) => {
      const next = new Set(prev);
      if (nextFavorite) next.add(assetId);
      else next.delete(assetId);
      return next;
    });

    try {
      const res = await fetch("/api/generate/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, isFavorite: nextFavorite }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not update favorite.");
      }

      if (showUndo) {
        toast.message(nextFavorite ? "Added to favorites." : "Removed from favorites.", {
          duration: 4500,
          action: {
            label: "Undo",
            onClick: () => {
              void applyFavorite(assetId, wasFavorite, { showUndo: false });
            },
          },
        });
      }
    } catch (e) {
      setFavoriteAssetIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(assetId);
        else next.delete(assetId);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Could not update favorite.");
    } finally {
      setFavoritingAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  }

  function toggleFavorite(assetId: string) {
    const wasFavorite = favoriteAssetIds.has(assetId);
    void applyFavorite(assetId, !wasFavorite);
  }

  function toggleSelected(assetId: string) {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const item of visibleItems) next.delete(item.assetId);
      } else {
        for (const item of visibleItems) next.add(item.assetId);
      }
      return next;
    });
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

  async function removeOneByAssetId(assetId: string) {
    const item = items.find((x) => x.assetId === assetId);
    if (!item) return { ok: false, reason: "NOT_FOUND" } as const;

    const res = await fetch("/api/generate/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false, reason: json?.error?.message || "Could not delete file." } as const;
    }

    if ((playingAssetId === assetId || activeAssetIdRef.current === assetId) && audioRef.current) {
      const audio = audioRef.current;
      audio.pause();
      setPlayingAssetId(null);
      if (activeAssetIdRef.current === assetId) {
        audio.removeAttribute("src");
        audio.load();
        setActiveAssetId(null);
        activeAssetIdRef.current = null;
        setCurrentTime(0);
        setDuration(0);
      }
    }

    setItems((prev) => prev.filter((x) => x.assetId !== assetId));
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(assetId);
      return next;
    });
    setFavoriteAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(assetId);
      return next;
    });
    setFavoritingAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(assetId);
      return next;
    });
    setAssetUrls((prev) => {
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
    if (editingAssetId === assetId) {
      setEditingAssetId(null);
      setEditingFileName("");
    }
    return { ok: true } as const;
  }

  async function deleteOne(item: LibraryItem) {
    const confirmed = window.confirm(`Delete \"${item.fileName}\" from your library?`);
    if (!confirmed) return;

    setDeletingAssetId(item.assetId);
    try {
      const result = await removeOneByAssetId(item.assetId);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      toast.success("File removed from library.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete file.");
    } finally {
      setDeletingAssetId(null);
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selectedAssetIds).filter((id) => items.some((item) => item.assetId === id));
    if (ids.length === 0) return;
    const confirmed = window.confirm(`Delete ${ids.length} selected track(s) from your library?`);
    if (!confirmed) return;

    setBatchDeleting(true);
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      const result = await removeOneByAssetId(id);
      if (result.ok) success += 1;
      else failed += 1;
    }

    setBatchDeleting(false);
    if (success > 0) toast.success(`${success} track(s) removed.`);
    if (failed > 0) toast.error(`${failed} track(s) could not be removed.`);
  }

  function downloadSelected() {
    const ids = Array.from(selectedAssetIds).filter((id) => items.some((item) => item.assetId === id));
    if (ids.length === 0) return;

    for (const id of ids) {
      const a = document.createElement("a");
      a.href = `/api/assets/${encodeURIComponent(id)}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    }
    toast.success(`Download started for ${ids.length} track(s).`);
  }

  const ensureAssetUrl = React.useCallback(
    async (assetId: string) => {
      const knownUrl = assetUrls[assetId];
      if (knownUrl) return knownUrl;

      setLoadingPlayAssetId(assetId);
      try {
        const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}?json=1`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message || "Could not load track.");
        }
        const url = String(json.data.url || "");
        if (!url) throw new Error("Could not load track.");
        setAssetUrls((prev) => ({ ...prev, [assetId]: url }));
        return url;
      } finally {
        setLoadingPlayAssetId(null);
      }
    },
    [assetUrls]
  );

  const playFromUrl = React.useCallback(async (assetId: string, url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.src !== url) {
      audio.src = url;
    } else if (activeAssetIdRef.current === assetId) {
      audio.currentTime = 0;
    }
    setActiveAssetId(assetId);
    activeAssetIdRef.current = assetId;
    try {
      await audio.play();
      setPlayingAssetId(assetId);
    } catch {
      toast.error("Could not play track.");
      setPlayingAssetId(null);
    }
  }, []);

  const playItem = React.useCallback(
    async (item: LibraryItem) => {
      try {
        const url = await ensureAssetUrl(item.assetId);
        await playFromUrl(item.assetId, url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load track.");
      }
    },
    [ensureAssetUrl, playFromUrl]
  );

  const togglePlay = React.useCallback(
    async (item: LibraryItem) => {
      const audio = audioRef.current;
      if (!audio) return;

      const currentId = activeAssetIdRef.current;
      if ((playingAssetId === item.assetId || currentId === item.assetId) && !audio.paused) {
        audio.pause();
        setPlayingAssetId(null);
        return;
      }

      if ((playingAssetId === item.assetId || currentId === item.assetId) && audio.paused && audio.src) {
        try {
          await audio.play();
          setPlayingAssetId(item.assetId);
          setActiveAssetId(item.assetId);
          return;
        } catch {
          // fall through to fresh load
        }
      }

      await playItem(item);
    },
    [playItem, playingAssetId]
  );

  const toggleCurrentPlayback = React.useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !activeItem) return;

    if (!audio.paused && playingAssetId === activeItem.assetId) {
      audio.pause();
      setPlayingAssetId(null);
      return;
    }

    if (audio.paused && activeAssetIdRef.current === activeItem.assetId && audio.src) {
      try {
        await audio.play();
        setPlayingAssetId(activeItem.assetId);
        return;
      } catch {
        // fall through
      }
    }

    await playItem(activeItem);
  }, [activeItem, playItem, playingAssetId]);

  const playNeighbor = React.useCallback(
    async (step: number) => {
      if (playQueueItems.length === 0) return;

      if (shuffleEnabled && playQueueItems.length > 1) {
        const currentId = activeItem?.assetId || activeAssetIdRef.current;
        const candidates = playQueueItems.filter((item) => item.assetId !== currentId);
        const target = candidates[Math.floor(Math.random() * candidates.length)] || playQueueItems[0];
        if (!target) return;
        await playItem(target);
        return;
      }

      const currentId = activeItem?.assetId || activeAssetIdRef.current;
      const currentIdx = currentId ? playQueueItems.findIndex((item) => item.assetId === currentId) : -1;
      const baseIdx = currentIdx === -1 ? (step >= 0 ? -1 : 0) : currentIdx;
      const nextIdx = (baseIdx + step + playQueueItems.length) % playQueueItems.length;
      const target = playQueueItems[nextIdx];
      if (!target) return;
      await playItem(target);
    },
    [activeItem, playItem, playQueueItems, shuffleEnabled]
  );

  function cycleRepeatMode() {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const repeatLabel = repeatMode === "off" ? "Repeat Off" : repeatMode === "all" ? "Repeat All" : "Repeat One";

  function seekTo(percent: number) {
    const audio = audioRef.current;
    const d = audio ? resolveDuration(audio) : 0;
    if (!audio || d <= 0) return;
    const nextTime = (Math.max(0, Math.min(100, percent)) / 100) * d;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function changeVolume(next: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const normalized = Math.max(0, Math.min(1, next));
    audio.volume = normalized;
    audio.muted = normalized === 0;
    setMuted(audio.muted);
    setVolume(normalized);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }

  function changePlaybackRate(next: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const normalized = Math.max(0.75, Math.min(1.5, next));
    audio.playbackRate = normalized;
    setPlaybackRate(normalized);
  }

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

  React.useEffect(() => {
    if (endedTick === 0) return;
    if (!activeItem) return;

    if (repeatMode === "one") {
      void playItem(activeItem);
      return;
    }

    if (playQueueItems.length === 0) return;

    if (shuffleEnabled && playQueueItems.length > 1) {
      const currentId = activeItem.assetId;
      const candidates = playQueueItems.filter((item) => item.assetId !== currentId);
      const target = candidates[Math.floor(Math.random() * candidates.length)] || playQueueItems[0];
      if (target) void playItem(target);
      return;
    }

    const currentIdx = playQueueItems.findIndex((item) => item.assetId === activeItem.assetId);
    if (currentIdx === -1) return;

    const hasNext = currentIdx < playQueueItems.length - 1;
    if (hasNext) {
      const target = playQueueItems[currentIdx + 1];
      if (target) void playItem(target);
      return;
    }

    if (repeatMode === "all") {
      const target = playQueueItems[0];
      if (target) void playItem(target);
    }
  }, [activeItem, endedTick, playItem, playQueueItems, repeatMode, shuffleEnabled]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (activeItem) {
          void toggleCurrentPlayback();
          return;
        }
        const first = playQueueItems[0];
        if (first) {
          void playItem(first);
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        if (playQueueItems.length === 0) return;
        event.preventDefault();
        void playNeighbor(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        if (playQueueItems.length === 0) return;
        event.preventDefault();
        void playNeighbor(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeItem, playItem, playNeighbor, playQueueItems, toggleCurrentPlayback]);

  return (
    <>
      <section
        className={
          "rounded-2xl border border-white/10 bg-[#101a35] p-4 md:p-5" +
          (activeItem ? " pb-36 md:pb-40" : "")
        }
      >
      <audio ref={audioRef} preload="none" className="hidden">
        <track kind="captions" srcLang="en" label="captions" src="data:text/vtt,WEBVTT" />
      </audio>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">Your generated tracks in a music-library view.</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/10 text-slate-100">{items.length} tracks</Badge>
          <Badge variant="outline" className="border-amber-300/45 bg-amber-400/10 text-amber-200">
            {favoriteCount} favorites
          </Badge>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "all" ? "default" : "outline"}
          className={
            (tab === "all" ? "bg-cyan-500/25 text-cyan-100 hover:bg-cyan-500/32" : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10") +
            " rounded-full cursor-pointer"
          }
          onClick={() => setTab("all")}
        >
          All
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "favorites" ? "default" : "outline"}
          className={
            (tab === "favorites"
              ? "bg-amber-500/25 text-amber-100 hover:bg-amber-500/32"
              : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10") +
            " rounded-full cursor-pointer"
          }
          onClick={() => setTab("favorites")}
        >
          <Star className="mr-1.5 h-3.5 w-3.5" />
          Favorites
        </Button>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by track or voice..."
            className="h-10 border-white/15 bg-white/5 pl-9 text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <select
          value={voiceFilter}
          onChange={(e) => setVoiceFilter(e.target.value)}
          className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
          aria-label="Filter by voice"
        >
          <option value="all">All voices</option>
          {voiceOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
          aria-label="Filter by date"
        >
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
          aria-label="Sort tracks"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="h-4 w-4 accent-cyan-400"
            disabled={visibleItems.length === 0}
          />
          Select visible
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{selectedAssetIds.size} selected</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
            onClick={downloadSelected}
            disabled={selectedAssetIds.size === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download Selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full border-rose-300/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 cursor-pointer"
            onClick={() => {
              void deleteSelected();
            }}
            disabled={selectedAssetIds.size === 0 || batchDeleting}
          >
            {batchDeleting ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Delete Selected
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No tracks in your library yet. Create a cover to see it here.
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No tracks match your current filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleItems.map((item) => {
            const isEditing = editingAssetId === item.assetId;
            const busy = savingAssetId === item.assetId || deletingAssetId === item.assetId || batchDeleting;
            const loadingPlay = loadingPlayAssetId === item.assetId;
            const playing = playingAssetId === item.assetId;
            const favorite = favoriteAssetIds.has(item.assetId);
            const favoriteBusy = favoritingAssetIds.has(item.assetId);
            const selected = selectedAssetIds.has(item.assetId);

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
                    : selected
                      ? "border-cyan-300/35"
                      : "border-white/10")
                }
              >
                <div className="mb-2 flex items-center justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(item.assetId)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    Select
                  </label>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={
                        "h-8 w-8 rounded-lg border cursor-pointer " +
                        (favorite
                          ? "border-amber-300/45 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                          : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10")
                      }
                      onClick={() => {
                        void toggleFavorite(item.assetId);
                      }}
                      disabled={favoriteBusy || busy}
                      aria-label={favorite ? "Remove favorite" : "Add favorite"}
                    >
                      {favoriteBusy ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className={"h-4 w-4 " + (favorite ? "fill-amber-300" : "")} />
                      )}
                    </Button>

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
                </div>

                <div className="relative overflow-hidden rounded-xl border border-white/10">
                  <VoiceLibraryCover voiceId={item.voiceId} alt={item.voiceName} />
                </div>

                <div className="mt-3 flex min-h-0 flex-1 flex-col">
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-lg font-semibold leading-tight text-slate-100">{item.fileName}</div>
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
                        onClick={() => {
                          void saveRename(item.assetId);
                        }}
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

      {activeItem ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-2 md:px-4">
          <div className="mx-auto w-full max-w-6xl pointer-events-auto overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(120deg,rgba(8,15,36,0.95)_0%,rgba(14,24,54,0.95)_45%,rgba(26,18,52,0.95)_100%)] shadow-[0_18px_70px_rgba(2,8,23,0.55)] backdrop-blur-xl">
            <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.3fr)_minmax(0,0.9fr)] md:items-center md:p-4">
              <div className="flex min-w-0 items-center gap-3">
                <MiniVoiceCover voiceId={activeItem.voiceId} alt={activeItem.voiceName} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">{activeItem.fileName}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-300">{activeItem.voiceName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">
                    {activeQueueIndex >= 0 ? <span>Queue {activeQueueIndex + 1}/{playQueueItems.length}</span> : null}
                    <span>{shuffleEnabled ? "Shuffle On" : "Shuffle Off"}</span>
                    <span>{repeatLabel}</span>
                    <span className="text-slate-500">Space / ← / →</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    "ml-auto shrink-0 " +
                    (playingAssetId === activeItem.assetId
                      ? "border-emerald-300/45 bg-emerald-400/12 text-emerald-200"
                      : "border-white/20 bg-white/10 text-slate-200")
                  }
                >
                  {playingAssetId === activeItem.assetId ? "Now Playing" : "Paused"}
                </Badge>
              </div>

              <div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={
                      "h-8 w-8 rounded-full border transition-colors cursor-pointer " +
                      (shuffleEnabled
                        ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                        : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10")
                    }
                    onClick={() => setShuffleEnabled((prev) => !prev)}
                    aria-label={shuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                    onClick={() => {
                      void playNeighbor(-1);
                    }}
                    disabled={playQueueItems.length < 2}
                    aria-label="Previous track"
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-full border-cyan-300/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 cursor-pointer"
                    onClick={() => {
                      void toggleCurrentPlayback();
                    }}
                    aria-label={playingAssetId === activeItem.assetId ? "Pause" : "Play"}
                  >
                    {playingAssetId === activeItem.assetId ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                    onClick={() => {
                      void playNeighbor(1);
                    }}
                    disabled={playQueueItems.length < 2}
                    aria-label="Next track"
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={
                      "h-8 w-8 rounded-full border transition-colors cursor-pointer " +
                      (repeatMode === "off"
                        ? "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                        : "border-fuchsia-300/50 bg-fuchsia-500/18 text-fuchsia-100 hover:bg-fuchsia-500/28")
                    }
                    onClick={cycleRepeatMode}
                    aria-label={`Repeat mode: ${repeatMode}`}
                  >
                    {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="w-10 shrink-0 text-right tabular-nums">{formatTime(currentTime)}</span>
                  <div className="relative h-2.5 w-full min-w-0">
                    <div className="absolute inset-0 rounded-full bg-white/15" />
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 shadow-[0_0_14px_rgba(34,211,238,0.4)]"
                      style={{ width: `${progress}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={progress}
                      onChange={(e) => seekTo(Number(e.target.value))}
                      aria-label="Seek"
                      className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                    />
                  </div>
                  <span className="w-10 shrink-0 tabular-nums">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-fuchsia-300"
                  aria-label="Volume"
                />

                <fieldset
                  aria-label="Playback speed"
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] p-0.5"
                >
                  {([0.75, 1, 1.25] as const).map((rate) => {
                    const activeRate = Math.abs(playbackRate - rate) < 0.001;
                    return (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => changePlaybackRate(rate)}
                        className={
                          "h-7 min-w-12 rounded-full px-2 text-[11px] font-semibold cursor-pointer transition-colors " +
                          (activeRate
                            ? "bg-cyan-500/30 text-cyan-100"
                            : "text-slate-200 hover:bg-white/10")
                        }
                      >
                        {rate}x
                      </button>
                    );
                  })}
                </fieldset>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
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

function MiniVoiceCover({ voiceId, alt }: { voiceId: string; alt: string }) {
  const [ok, setOk] = React.useState(true);
  const src = `/api/voices/${encodeURIComponent(voiceId)}/cover`;

  if (!ok) {
    return (
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-fuchsia-500/25 text-slate-100">
        <FileAudio className="h-5 w-5" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-12 w-12 shrink-0 rounded-xl object-cover"
      onError={() => setOk(false)}
    />
  );
}

function formatCreated(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function resolveDuration(audio: HTMLAudioElement) {
  const d = audio.duration;
  if (Number.isFinite(d) && d > 0) return d;
  const seekable = audio.seekable;
  if (seekable && seekable.length > 0) {
    const end = seekable.end(seekable.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  return 0;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return !!target.closest("input, textarea, select, [contenteditable='true']");
}

function matchesDateFilter(iso: string, filter: DateFilter) {
  if (filter === "all") return true;
  const createdMs = new Date(iso).getTime();
  if (!Number.isFinite(createdMs)) return false;
  const now = Date.now();
  const ageMs = now - createdMs;
  const day = 24 * 60 * 60 * 1000;
  if (filter === "7d") return ageMs <= 7 * day;
  if (filter === "30d") return ageMs <= 30 * day;
  return ageMs <= 90 * day;
}
