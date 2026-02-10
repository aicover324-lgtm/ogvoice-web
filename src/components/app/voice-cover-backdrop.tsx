"use client";

import * as React from "react";

export function VoiceCoverBackdrop({
  voiceId,
  opacity = 0.18,
  blurClassName = "blur-2xl",
}: {
  voiceId: string;
  opacity?: number;
  blurClassName?: string;
}) {
  const [ok, setOk] = React.useState(true);
  const [k, setK] = React.useState(0);

  React.useEffect(() => {
    void voiceId;
    setK(Date.now());
    setOk(true);
  }, [voiceId]);

  const src = `/api/voices/${encodeURIComponent(voiceId)}/cover?v=${k}`;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Always render a premium backdrop, even without a cover. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_15%_18%,hsl(var(--primary)/0.14),transparent_60%),radial-gradient(55%_55%_at_85%_15%,hsl(var(--chart-2)/0.12),transparent_60%),radial-gradient(40%_55%_at_70%_85%,hsl(var(--chart-3)/0.10),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.14] mix-blend-overlay bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.55)_0px,rgba(255,255,255,0.55)_1px,transparent_1px,transparent_10px)]" />

      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full scale-110 object-cover ${blurClassName}`}
          style={{ opacity }}
          onError={() => setOk(false)}
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-br from-background/88 via-background/68 to-background/88" />
    </div>
  );
}
