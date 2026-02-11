"use client";

import * as React from "react";
import { Image as ImageIcon } from "lucide-react";

export function VoiceCoverHero({
  voiceId,
  nonce,
}: {
  voiceId: string;
  nonce: number;
}) {
  const [ok, setOk] = React.useState(true);

  React.useEffect(() => {
    void voiceId;
    void nonce;
    setOk(true);
  }, [voiceId, nonce]);

  const src = `/api/voices/${encodeURIComponent(voiceId)}/cover?v=${nonce}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-muted/40 dark:border-white/10 dark:bg-white/5">
      <div className="aspect-[16/9] w-full">
        {ok ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Cover"
            className="h-full w-full object-cover"
            onError={() => setOk(false)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="grid place-items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
              <div className="text-xs">No cover</div>
            </div>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/6 dark:ring-white/10" />
    </div>
  );
}
