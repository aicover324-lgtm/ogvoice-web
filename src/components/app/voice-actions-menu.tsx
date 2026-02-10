"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUploader, type ImageUploaderHandle } from "@/components/app/image-uploader";

export function VoiceActionsMenu({ voiceId }: { voiceId: string }) {
  const router = useRouter();
  const uploaderRef = React.useRef<ImageUploaderHandle | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function onDelete() {
    setDeleting(true);
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setDeleting(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Delete failed");
      return;
    }

    toast.success("Voice moved to cleanup queue");
    setDeleteOpen(false);
    router.push("/app/voices");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" aria-label="Voice settings">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              uploaderRef.current?.openPicker();
            }}
          >
            <ImagePlus className="h-4 w-4" />
            Replace cover
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete voice
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImageUploader ref={uploaderRef} headless type="voice_cover_image" voiceProfileId={voiceId} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this voice?</DialogTitle>
            <DialogDescription>
              This removes it from your dashboard now. Files will be permanently deleted later by the automatic cleanup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void onDelete()} disabled={deleting} className="rounded-full">
              {deleting ? "Deleting..." : "Delete voice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
