"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CheckoutButton({ label }: { label: string }) {
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
    <Button className="w-full rounded-full" onClick={onClick} disabled={loading}>
      {loading ? "Redirecting..." : label}
    </Button>
  );
}
