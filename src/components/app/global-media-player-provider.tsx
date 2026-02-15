"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileAudio,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";

export type GlobalMediaTrack = {
  assetId: string;
  fileName: string;
  voiceId: string;
  voiceName: string;
};

type RepeatMode = "off" | "all" | "one";
type DockPosition = { x: number; y: number };

const PLAYER_MINIMIZED_STORAGE_KEY = "ogvoice.player.minimized";
const PLAYER_DOCK_POSITION_STORAGE_KEY = "ogvoice.player.dockPosition";

type GlobalMediaPlayerContextValue = {
  activeTrack: GlobalMediaTrack | null;
  playingAssetId: string | null;
  loadingAssetId: string | null;
  toggleTrack: (track: GlobalMediaTrack, queue?: GlobalMediaTrack[]) => Promise<void>;
  playTrack: (track: GlobalMediaTrack, queue?: GlobalMediaTrack[]) => Promise<void>;
  closePlayer: () => void;
};

const GlobalMediaPlayerContext = React.createContext<GlobalMediaPlayerContextValue | null>(null);

export function useGlobalMediaPlayer() {
  const ctx = React.useContext(GlobalMediaPlayerContext);
  if (!ctx) {
    throw new Error("useGlobalMediaPlayer must be used inside GlobalMediaPlayerProvider");
  }
  return ctx;
}

export function GlobalMediaPlayerProvider({ children }: { children: React.ReactNode }) {
  const [activeTrack, setActiveTrack] = React.useState<GlobalMediaTrack | null>(null);
  const [playingAssetId, setPlayingAssetId] = React.useState<string | null>(null);
  const [loadingAssetId, setLoadingAssetId] = React.useState<string | null>(null);
  const [assetUrls, setAssetUrls] = React.useState<Record<string, string>>({});
  const [queue, setQueue] = React.useState<GlobalMediaTrack[]>([]);
  const [shuffleEnabled, setShuffleEnabled] = React.useState(false);
  const [repeatMode, setRepeatMode] = React.useState<RepeatMode>("off");
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isDraggingDock, setIsDraggingDock] = React.useState(false);
  const [dockPosition, setDockPosition] = React.useState<DockPosition | null>(null);
  const [prefsHydrated, setPrefsHydrated] = React.useState(false);
  const [endedTick, setEndedTick] = React.useState(0);

  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(0.9);
  const [muted, setMuted] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const activeTrackRef = React.useRef<GlobalMediaTrack | null>(null);
  const dockRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{ offsetX: number; offsetY: number } | null>(null);

  React.useEffect(() => {
    activeTrackRef.current = activeTrack;
  }, [activeTrack]);

  React.useEffect(() => {
    try {
      const minimizedRaw = window.localStorage.getItem(PLAYER_MINIMIZED_STORAGE_KEY);
      if (minimizedRaw === "1") {
        setIsMinimized(true);
      }

      const posRaw = window.localStorage.getItem(PLAYER_DOCK_POSITION_STORAGE_KEY);
      if (posRaw) {
        const parsed = JSON.parse(posRaw) as unknown;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          typeof (parsed as { x?: unknown }).x === "number" &&
          typeof (parsed as { y?: unknown }).y === "number"
        ) {
          setDockPosition({
            x: (parsed as { x: number }).x,
            y: (parsed as { y: number }).y,
          });
        }
      }
    } catch {
      // no-op
    } finally {
      setPrefsHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (!prefsHydrated) return;
    try {
      window.localStorage.setItem(PLAYER_MINIMIZED_STORAGE_KEY, isMinimized ? "1" : "0");
    } catch {
      // no-op
    }
  }, [isMinimized, prefsHydrated]);

  React.useEffect(() => {
    if (!prefsHydrated) return;
    try {
      if (!dockPosition) {
        window.localStorage.removeItem(PLAYER_DOCK_POSITION_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(PLAYER_DOCK_POSITION_STORAGE_KEY, JSON.stringify(dockPosition));
    } catch {
      // no-op
    }
  }, [dockPosition, prefsHydrated]);

  const ensureAssetUrl = React.useCallback(
    async (assetId: string) => {
      const knownUrl = assetUrls[assetId];
      if (knownUrl) return knownUrl;

      setLoadingAssetId(assetId);
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
        setLoadingAssetId(null);
      }
    },
    [assetUrls]
  );

  const playTrack = React.useCallback(
    async (track: GlobalMediaTrack, queueOverride?: GlobalMediaTrack[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (queueOverride && queueOverride.length > 0) {
        setQueue(dedupeTracks(queueOverride));
      } else {
        setQueue((prev) => (prev.length > 0 ? prev : [track]));
      }

      try {
        const url = await ensureAssetUrl(track.assetId);
        if (audio.src !== url) {
          audio.src = url;
        } else if (activeTrackRef.current?.assetId === track.assetId) {
          audio.currentTime = 0;
        }

        setActiveTrack(track);
        activeTrackRef.current = track;
        await audio.play();
        setPlayingAssetId(track.assetId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not play track.");
        setPlayingAssetId(null);
      }
    },
    [ensureAssetUrl]
  );

  const toggleTrack = React.useCallback(
    async (track: GlobalMediaTrack, queueOverride?: GlobalMediaTrack[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (queueOverride && queueOverride.length > 0) {
        setQueue(dedupeTracks(queueOverride));
      }

      const currentId = activeTrackRef.current?.assetId;
      const sameTrack = currentId === track.assetId;
      if (sameTrack && !audio.paused) {
        audio.pause();
        setPlayingAssetId(null);
        return;
      }

      if (sameTrack && audio.paused && audio.src) {
        try {
          await audio.play();
          setPlayingAssetId(track.assetId);
          setActiveTrack(track);
          return;
        } catch {
          // fall through
        }
      }

      await playTrack(track, queueOverride);
    },
    [playTrack]
  );

  const playNeighbor = React.useCallback(
    async (step: number, opts?: { allowWrap?: boolean }) => {
      const current = activeTrackRef.current;
      if (!current) return;
      const source = queue.length > 0 ? queue : [current];
      if (source.length === 0) return;

      if (shuffleEnabled && source.length > 1) {
        const candidates = source.filter((item) => item.assetId !== current.assetId);
        const target = candidates[Math.floor(Math.random() * candidates.length)] || source[0];
        if (target) await playTrack(target);
        return;
      }

      const allowWrap = opts?.allowWrap !== false;
      const currentIdx = source.findIndex((item) => item.assetId === current.assetId);
      const baseIdx = currentIdx === -1 ? (step >= 0 ? -1 : 0) : currentIdx;
      const nextIdx = baseIdx + step;

      if (!allowWrap && (nextIdx < 0 || nextIdx >= source.length)) return;
      const resolvedIdx = (nextIdx + source.length) % source.length;
      const target = source[resolvedIdx];
      if (target) await playTrack(target);
    },
    [playTrack, queue, shuffleEnabled]
  );

  const toggleCurrentPlayback = React.useCallback(async () => {
    const audio = audioRef.current;
    const current = activeTrackRef.current;
    if (!audio || !current) return;

    if (!audio.paused && playingAssetId === current.assetId) {
      audio.pause();
      setPlayingAssetId(null);
      return;
    }

    if (audio.paused && activeTrackRef.current?.assetId === current.assetId && audio.src) {
      try {
        await audio.play();
        setPlayingAssetId(current.assetId);
        return;
      } catch {
        // fall through
      }
    }

    await playTrack(current);
  }, [playTrack, playingAssetId]);

  const closePlayer = React.useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setPlayingAssetId(null);
    setLoadingAssetId(null);
    setActiveTrack(null);
    activeTrackRef.current = null;
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    setIsMinimized(false);
    setIsDraggingDock(false);
    setDockPosition(null);
  }, []);

  const positionDockWithinViewport = React.useCallback((next: DockPosition) => {
    const width = dockRef.current?.offsetWidth ?? 360;
    const height = dockRef.current?.offsetHeight ?? 88;
    const margin = 10;
    const topInset = 68;
    const leftInset = window.innerWidth >= 768 ? 288 : 0;

    const minX = leftInset + margin;
    const maxX = Math.max(minX, window.innerWidth - width - margin);
    const minY = topInset;
    const maxY = Math.max(minY, window.innerHeight - height - margin);

    return {
      x: Math.min(Math.max(next.x, minX), maxX),
      y: Math.min(Math.max(next.y, minY), maxY),
    };
  }, []);

  const placeDockDefault = React.useCallback(() => {
    const width = dockRef.current?.offsetWidth ?? 360;
    const height = dockRef.current?.offsetHeight ?? 88;
    const margin = 14;
    const leftInset = window.innerWidth >= 768 ? 288 : 0;
    const start: DockPosition = {
      x: Math.max(leftInset + margin, window.innerWidth - width - margin),
      y: Math.max(80, window.innerHeight - height - margin),
    };
    setDockPosition(positionDockWithinViewport(start));
  }, [positionDockWithinViewport]);

  const endDockDrag = React.useCallback(() => {
    dragRef.current = null;
    setIsDraggingDock(false);
  }, []);

  const onDockPointerMove = React.useCallback(
    (event: PointerEvent) => {
      if (!dragRef.current) return;
      const next = {
        x: event.clientX - dragRef.current.offsetX,
        y: event.clientY - dragRef.current.offsetY,
      };
      setDockPosition(positionDockWithinViewport(next));
    },
    [positionDockWithinViewport]
  );

  const onDockPointerUp = React.useCallback(() => {
    window.removeEventListener("pointermove", onDockPointerMove);
    window.removeEventListener("pointerup", onDockPointerUp);
    endDockDrag();
  }, [endDockDrag, onDockPointerMove]);

  const beginDockDrag = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dockRef.current) return;
      const target = event.target as HTMLElement;
      if (target.closest("button, a, input, textarea, select")) return;

      const rect = dockRef.current.getBoundingClientRect();
      dragRef.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      setIsDraggingDock(true);
      window.addEventListener("pointermove", onDockPointerMove);
      window.addEventListener("pointerup", onDockPointerUp);
    },
    [onDockPointerMove, onDockPointerUp]
  );

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

  function cycleRepeatMode() {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }

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
      const currentId = activeTrackRef.current?.assetId;
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
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("volumechange", onVolume);
    audio.addEventListener("ratechange", onRate);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("loadeddata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("volumechange", onVolume);
      audio.removeEventListener("ratechange", onRate);
    };
  }, []);

  React.useEffect(() => {
    if (endedTick === 0) return;
    const current = activeTrackRef.current;
    if (!current) return;

    if (repeatMode === "one") {
      void playTrack(current);
      return;
    }

    const source = queue.length > 0 ? queue : [current];
    if (source.length === 0) return;

    if (shuffleEnabled && source.length > 1) {
      const candidates = source.filter((item) => item.assetId !== current.assetId);
      const target = candidates[Math.floor(Math.random() * candidates.length)] || source[0];
      if (target) void playTrack(target);
      return;
    }

    const currentIdx = source.findIndex((item) => item.assetId === current.assetId);
    if (currentIdx === -1) return;
    const hasNext = currentIdx < source.length - 1;
    if (hasNext) {
      const target = source[currentIdx + 1];
      if (target) void playTrack(target);
      return;
    }

    if (repeatMode === "all") {
      const target = source[0];
      if (target) void playTrack(target);
    }
  }, [endedTick, playTrack, queue, repeatMode, shuffleEnabled]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (activeTrackRef.current) {
          void toggleCurrentPlayback();
          return;
        }
        const first = queue[0];
        if (first) {
          void playTrack(first);
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        if (!activeTrackRef.current) return;
        event.preventDefault();
        void playNeighbor(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        if (!activeTrackRef.current) return;
        event.preventDefault();
        void playNeighbor(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playNeighbor, playTrack, queue, toggleCurrentPlayback]);

  React.useEffect(() => {
    if (!activeTrack || !isMinimized) return;
    const t = window.setTimeout(() => {
      if (dockPosition) {
        setDockPosition((prev) => (prev ? positionDockWithinViewport(prev) : prev));
      } else {
        placeDockDefault();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [activeTrack, dockPosition, isMinimized, placeDockDefault, positionDockWithinViewport]);

  React.useEffect(() => {
    if (!isMinimized) return;
    const onResize = () => {
      setDockPosition((prev) => {
        if (!prev) return prev;
        return positionDockWithinViewport(prev);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMinimized, positionDockWithinViewport]);

  React.useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDockPointerMove);
      window.removeEventListener("pointerup", onDockPointerUp);
    };
  }, [onDockPointerMove, onDockPointerUp]);

  const activeQueueIndex = React.useMemo(() => {
    if (!activeTrack) return -1;
    return queue.findIndex((item) => item.assetId === activeTrack.assetId);
  }, [activeTrack, queue]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const repeatLabel = repeatMode === "off" ? "Repeat Off" : repeatMode === "all" ? "Repeat All" : "Repeat One";

  const value = React.useMemo<GlobalMediaPlayerContextValue>(
    () => ({
      activeTrack,
      playingAssetId,
      loadingAssetId,
      toggleTrack,
      playTrack,
      closePlayer,
    }),
    [activeTrack, closePlayer, loadingAssetId, playTrack, playingAssetId, toggleTrack]
  );

  return (
    <GlobalMediaPlayerContext.Provider value={value}>
      <audio ref={audioRef} preload="none" className="hidden">
        <track kind="captions" srcLang="en" label="captions" src="data:text/vtt,WEBVTT" />
      </audio>

      {children}

      {activeTrack ? (
        isMinimized ? (
          <div
            ref={dockRef}
            className={
              "fixed z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-cyan-300/25 bg-[linear-gradient(120deg,rgba(8,15,36,0.95)_0%,rgba(14,24,54,0.95)_45%,rgba(26,18,52,0.95)_100%)] shadow-[0_18px_70px_rgba(2,8,23,0.55)] backdrop-blur-xl " +
              (isDraggingDock ? "cursor-grabbing" : "cursor-grab")
            }
            style={
              dockPosition
                ? { left: dockPosition.x, top: dockPosition.y }
                : { right: 14, bottom: 14 }
            }
            onPointerDown={beginDockDrag}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-slate-400">
              <GripHorizontal className="h-3.5 w-3.5" />
              Drag Player
              <span className="ml-auto">{playingAssetId === activeTrack.assetId ? "Playing" : "Paused"}</span>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <MiniVoiceCover voiceId={activeTrack.voiceId} alt={activeTrack.voiceName} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-100">{activeTrack.fileName}</div>
                <div className="truncate text-[11px] text-slate-300">{activeTrack.voiceName}</div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-cyan-300/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 cursor-pointer"
                onClick={() => {
                  void toggleCurrentPlayback();
                }}
                aria-label={playingAssetId === activeTrack.assetId ? "Pause" : "Play"}
              >
                {playingAssetId === activeTrack.assetId ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                onClick={() => setIsMinimized(false)}
                aria-label="Expand player"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                onClick={closePlayer}
                aria-label="Close player"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-2 md:left-72 md:px-4">
            <div className="mx-auto w-full max-w-6xl pointer-events-auto overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(120deg,rgba(8,15,36,0.95)_0%,rgba(14,24,54,0.95)_45%,rgba(26,18,52,0.95)_100%)] shadow-[0_18px_70px_rgba(2,8,23,0.55)] backdrop-blur-xl">
              <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.3fr)_minmax(0,0.9fr)] md:items-center md:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <MiniVoiceCover voiceId={activeTrack.voiceId} alt={activeTrack.voiceName} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{activeTrack.fileName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-300">{activeTrack.voiceName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">
                      {activeQueueIndex >= 0 ? <span>Queue {activeQueueIndex + 1}/{queue.length}</span> : null}
                      <span>{shuffleEnabled ? "Shuffle On" : "Shuffle Off"}</span>
                      <span>{repeatLabel}</span>
                      <span className="text-slate-500">Space / ← / →</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      "ml-auto shrink-0 " +
                      (playingAssetId === activeTrack.assetId
                        ? "border-emerald-300/45 bg-emerald-400/12 text-emerald-200"
                        : "border-white/20 bg-white/10 text-slate-200")
                    }
                  >
                    {playingAssetId === activeTrack.assetId ? "Now Playing" : "Paused"}
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
                      disabled={queue.length < 2 && !activeTrack}
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
                      aria-label={playingAssetId === activeTrack.assetId ? "Pause" : "Play"}
                    >
                      {playingAssetId === activeTrack.assetId ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                      onClick={() => {
                        void playNeighbor(1);
                      }}
                      disabled={queue.length < 2 && !activeTrack}
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
                    className="inline-flex shrink-0 items-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06] p-0.5"
                  >
                    {([0.75, 1, 1.25] as const).map((rate) => {
                      const activeRate = Math.abs(playbackRate - rate) < 0.001;
                      return (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => changePlaybackRate(rate)}
                          className={
                            "h-7 min-w-[42px] rounded-full px-2 text-[11px] font-semibold cursor-pointer transition-colors " +
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

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                    onClick={() => setIsMinimized(true)}
                    aria-label="Minimize player"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
                    onClick={closePlayer}
                    aria-label="Close player"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : null}
    </GlobalMediaPlayerContext.Provider>
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

function dedupeTracks(tracks: GlobalMediaTrack[]) {
  const seen = new Set<string>();
  const out: GlobalMediaTrack[] = [];
  for (const track of tracks) {
    if (seen.has(track.assetId)) continue;
    seen.add(track.assetId);
    out.push(track);
  }
  return out;
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
