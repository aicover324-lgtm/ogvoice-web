"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BillingPortalButton() {
  const [loading, setLoading] = React.useState(false);

  async function openPortal() {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    if (res.redirected) {
      setLoading(false);
      window.location.href = res.url;
      return;
    }
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Billing portal unavailable");
      return;
    }
    window.location.href = json.data.url;
  }

  return (
    <Button onClick={openPortal} disabled={loading} variant="outline" className="rounded-full">
      {loading ? "Opening..." : "Open billing portal"}
    </Button>
  );
}
