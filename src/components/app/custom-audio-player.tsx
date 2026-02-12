"use client";

import * as React from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type CustomAudioPlayerProps = {
  src?: string | null;
  preload?: "none" | "metadata" | "auto";
  className?: string;
  variant?: "default" | "compact";
  onPlayStateChange?: (playing: boolean) => void;
};

export const CustomAudioPlayer = React.forwardRef<HTMLAudioElement, CustomAudioPlayerProps>(
  function CustomAudioPlayer(
    { src, preload = "metadata", className, variant = "default", onPlayStateChange },
    forwardedRef
  ) {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const [duration, setDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [volume, setVolume] = React.useState(0.9);
    const [muted, setMuted] = React.useState(false);
    const [speed, setSpeed] = React.useState(1);

    React.useImperativeHandle(forwardedRef, () => audioRef.current as HTMLAudioElement, []);

    React.useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const onLoaded = () => {
        setDuration(resolveDuration(audio));
      };
      const onTime = () => {
        setCurrentTime(audio.currentTime || 0);
        const d = resolveDuration(audio);
        if (d > 0) setDuration(d);
      };
      const onPlay = () => {
        setPlaying(true);
        onPlayStateChange?.(true);
      };
      const onPause = () => {
        setPlaying(false);
        onPlayStateChange?.(false);
      };
      const onVolume = () => {
        setMuted(audio.muted);
        setVolume(audio.volume);
      };
      const onRate = () => {
        setSpeed(audio.playbackRate || 1);
      };
      const onDurationChange = () => {
        setDuration(resolveDuration(audio));
      };

      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("loadeddata", onLoaded);
      audio.addEventListener("timeupdate", onTime);
      audio.addEventListener("durationchange", onDurationChange);
      audio.addEventListener("play", onPlay);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("ended", onPause);
      audio.addEventListener("volumechange", onVolume);
      audio.addEventListener("ratechange", onRate);

      return () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("loadeddata", onLoaded);
        audio.removeEventListener("timeupdate", onTime);
        audio.removeEventListener("durationchange", onDurationChange);
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("ended", onPause);
        audio.removeEventListener("volumechange", onVolume);
        audio.removeEventListener("ratechange", onRate);
      };
    }, [onPlayStateChange]);

    React.useEffect(() => {
      if (!src) {
        setPlaying(false);
        setDuration(0);
        setCurrentTime(0);
        onPlayStateChange?.(false);
      }
    }, [onPlayStateChange, src]);

    function togglePlay() {
      const audio = audioRef.current;
      if (!audio || !src) return;
      if (audio.paused) {
        void audio.play().catch(() => null);
      } else {
        audio.pause();
      }
    }

    function seekTo(percent: number) {
      const audio = audioRef.current;
      const d = audio ? resolveDuration(audio) : 0;
      if (!audio || d <= 0) return;
      const next = (Math.max(0, Math.min(100, percent)) / 100) * d;
      audio.currentTime = next;
      setCurrentTime(next);
    }

    function onVolumeChange(next: number) {
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

    function changeSpeed(next: number) {
      const audio = audioRef.current;
      if (!audio) return;
      const value = Math.max(0.5, Math.min(2, next));
      audio.playbackRate = value;
      setSpeed(value);
    }

    const hasSrc = !!src;
    const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

    return (
      <div
        className={cn(
          "w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/12 bg-[#0f1730]",
          variant === "compact" ? "p-2.5" : "p-3",
          className
        )}
      >
        <audio ref={audioRef} src={src || undefined} preload={preload}>
          <track kind="captions" srcLang="en" label="captions" src="data:text/vtt,WEBVTT" />
        </audio>

        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasSrc}
            aria-label={playing ? "Pause" : "Play"}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors",
              hasSrc
                ? "cursor-pointer border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
                : "cursor-not-allowed border-white/15 bg-white/5 text-slate-500"
            )}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <div className="relative h-2.5 w-full min-w-0">
            <div className="absolute inset-0 rounded-full bg-white/15" />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 shadow-[0_0_14px_rgba(34,211,238,0.5)] transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
            <div
              className={cn(
                "pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border",
                hasSrc
                  ? "border-cyan-100/70 bg-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.85)]"
                  : "border-slate-400/40 bg-slate-400/50"
              )}
              style={{ left: `calc(${progress}% - 6px)` }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              onChange={(e) => seekTo(Number(e.target.value))}
              disabled={!hasSrc}
              aria-label="Seek"
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
            />
          </div>

          <div className="shrink-0 text-[11px] font-semibold text-slate-200 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              disabled={!hasSrc}
              aria-label={muted ? "Unmute" : "Mute"}
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors",
                hasSrc ? "cursor-pointer text-slate-200 hover:bg-white/10" : "cursor-not-allowed text-slate-500"
              )}
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              disabled={!hasSrc}
              aria-label="Volume"
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-white/15 accent-fuchsia-300 sm:w-32 disabled:cursor-not-allowed"
            />
          </div>

          <fieldset
            aria-label="Playback speed"
            className="inline-flex shrink-0 items-center rounded-md border border-white/15 bg-white/[0.04] p-0.5"
          >
            {([0.75, 1, 1.25] as const).map((v) => {
              const active = Math.abs(speed - v) < 0.001;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeSpeed(v)}
                  disabled={!hasSrc}
                  className={cn(
                    "h-6 min-w-11 rounded px-1.5 text-[10px] font-semibold transition-colors",
                    hasSrc
                      ? active
                        ? "cursor-pointer bg-cyan-400/20 text-cyan-200"
                        : "cursor-pointer text-slate-300 hover:bg-white/10 hover:text-slate-100"
                      : "cursor-not-allowed text-slate-500"
                  )}
                >
                  {v}x
                </button>
              );
            })}
          </fieldset>
        </div>
      </div>
    );
  }
);

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
