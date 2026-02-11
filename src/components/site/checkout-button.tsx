"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CheckoutButton({ label, className }: { label: string; className?: string }) {
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    if (res.redirected) {
      setLoading(false);
      window.location.href = res.url;
      return;
    }
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Stripe checkout unavailable");
      return;
    }
    window.location.href = json.data.url;
  }

  return (
    <Button
      className={cn(
        "h-11 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white hover:from-cyan-500 hover:to-fuchsia-500 disabled:pointer-events-auto disabled:cursor-not-allowed",
        className
      )}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "Redirecting..." : label}
    </Button>
  );
}
