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
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      };
      const onTime = () => setCurrentTime(audio.currentTime || 0);
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

      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("timeupdate", onTime);
      audio.addEventListener("play", onPlay);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("ended", onPause);
      audio.addEventListener("volumechange", onVolume);
      audio.addEventListener("ratechange", onRate);

      return () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("timeupdate", onTime);
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
      if (!audio || duration <= 0) return;
      const next = (Math.max(0, Math.min(100, percent)) / 100) * duration;
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
          "rounded-xl border border-white/12 bg-[#0f1730]",
          variant === "compact" ? "p-2.5" : "p-3",
          className
        )}
      >
        <audio ref={audioRef} src={src || undefined} preload={preload}>
          <track kind="captions" srcLang="en" label="captions" src="data:text/vtt,WEBVTT" />
        </audio>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasSrc}
            aria-label={playing ? "Pause" : "Play"}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border transition-colors",
              hasSrc
                ? "cursor-pointer border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
                : "cursor-not-allowed border-white/15 bg-white/5 text-slate-500"
            )}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <div className="min-w-[88px] text-xs font-semibold text-slate-200 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={(e) => seekTo(Number(e.target.value))}
            disabled={!hasSrc}
            aria-label="Seek"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-300 disabled:cursor-not-allowed"
          />

          <button
            type="button"
            onClick={toggleMute}
            disabled={!hasSrc}
            aria-label={muted ? "Unmute" : "Mute"}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md transition-colors",
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
            className="hidden h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/15 accent-fuchsia-300 lg:block disabled:cursor-not-allowed"
          />

          <fieldset
            aria-label="Playback speed"
            className="hidden items-center rounded-md border border-white/15 bg-white/[0.04] p-0.5 sm:inline-flex"
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
