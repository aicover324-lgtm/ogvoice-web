"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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

export function DeleteDatasetFileButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function remove() {
    setLoading(true);
    const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Delete failed");
      return;
    }
    toast.success("File deleted");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={remove} disabled={loading} aria-label="Delete file">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function DeleteAllDatasetButton({ voiceProfileId, disabled }: { voiceProfileId: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function removeAll() {
    setLoading(true);
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceProfileId)}/dataset-assets`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Delete failed");
      return;
    }

    toast.success("Dataset cleared");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full" disabled={disabled}>
          Clear dataset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear this dataset?</DialogTitle>
          <DialogDescription>
            This deletes all dataset files for this voice from storage. You can upload a fresh dataset afterward.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" className="rounded-full" onClick={removeAll} disabled={loading}>
            {loading ? "Deleting..." : "Delete all files"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
