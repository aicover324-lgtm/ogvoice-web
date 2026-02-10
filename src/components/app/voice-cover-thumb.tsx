"use client";

import * as React from "react";
import { Image as ImageIcon } from "lucide-react";

export function VoiceCoverThumb({
  voiceId,
  size = 44,
  className,
}: {
  voiceId: string;
  size?: number;
  className?: string;
}) {
  const [ok, setOk] = React.useState(true);
  const [k, setK] = React.useState(0);

  React.useEffect(() => {
    // Cache-bust on client to avoid stale covers.
    void voiceId;
    setK(Date.now());
    setOk(true);
  }, [voiceId]);

  const src = `/api/voices/${encodeURIComponent(voiceId)}/cover?v=${k}`;

  return (
    <div
      className={
        className ||
        "group relative grid place-items-center overflow-hidden rounded-2xl border bg-muted shadow-sm"
      }
      style={{ width: size, height: size }}
      role="img"
      aria-label="Voice cover"
    >
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Cover"
          className="h-full w-full object-cover"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="grid place-items-center gap-1 text-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Premium glass / highlight layer */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/12" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/18 via-white/0 to-white/0 opacity-70 mix-blend-overlay" />
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.18)]" />
        <div className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-br from-white/8 via-white/0 to-white/0" />
      </div>
    </div>
  );
}
