import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PremiumCard({
  className,
  children,
  contentClassName,
}: {
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/5 bg-white/62 shadow-[0_18px_70px_rgba(2,8,23,0.12)] backdrop-blur-xl",
        "dark:border-white/10 dark:bg-black/24 dark:shadow-[0_30px_90px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      {/* Neutral glass layers (no colored gradients) */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55] bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.07)_1px,transparent_0)] bg-[size:16px_16px] dark:opacity-[0.22] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/45 via-white/0 to-transparent opacity-70 dark:from-white/10" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/8 dark:ring-white/10" />
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </Card>
  );
}
