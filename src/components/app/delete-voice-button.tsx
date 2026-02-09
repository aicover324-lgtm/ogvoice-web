"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteVoiceButton({ voiceId }: { voiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onDelete() {
    setLoading(true);
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Delete failed");
      return;
    }

    toast.success("Voice moved to cleanup queue");
    setOpen(false);
    router.push("/app/voices");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="rounded-full">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this voice?</DialogTitle>
          <DialogDescription>
            This removes it from your dashboard now. Files will be permanently deleted later by the automatic cleanup.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={loading} className="rounded-full">
            {loading ? "Deleting..." : "Delete voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
