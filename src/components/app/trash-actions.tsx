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

export function RestoreVoiceButton({ voiceId }: { voiceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function restore() {
    setLoading(true);
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceId)}/restore`, { method: "POST" });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Restore failed");
      return;
    }
    toast.success("Voice restored");
    router.refresh();
  }

  return (
    <Button variant="outline" className="rounded-full" onClick={restore} disabled={loading}>
      {loading ? "Restoring..." : "Restore"}
    </Button>
  );
}

export function PurgeVoiceButton({ voiceId }: { voiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function purge() {
    setLoading(true);
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceId)}/purge`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Delete failed");
      return;
    }
    toast.success("Voice permanently deleted");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="rounded-full">
          Delete forever
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete forever?</DialogTitle>
          <DialogDescription>
            This permanently deletes this voice and its uploaded files. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" className="rounded-full" onClick={purge} disabled={loading}>
            {loading ? "Deleting..." : "Delete forever"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
