"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function VoiceActionsMenu({
  voiceId,
  initialName,
  initialLanguage,
  initialDescription,
  onVoiceUpdated,
  onCoverReplaced,
  disabled,
  disabledReason,
}: {
  voiceId: string;
  initialName?: string;
  initialLanguage?: string | null;
  initialDescription?: string | null;
  onVoiceUpdated?: (next: { name: string; language: string | null; description: string | null }) => void;
  onCoverReplaced?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const uploaderRef = React.useRef<ImageUploaderHandle | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [name, setName] = React.useState(initialName || "");
  const [language, setLanguage] = React.useState(initialLanguage || "");
  const [description, setDescription] = React.useState(initialDescription || "");

  React.useEffect(() => {
    setName(initialName || "");
    setLanguage(initialLanguage || "");
    setDescription(initialDescription || "");
  }, [initialName, initialLanguage, initialDescription]);

  React.useEffect(() => {
    if (disabled && menuOpen) {
      setMenuOpen(false);
    }
  }, [disabled, menuOpen]);

  const canEdit = typeof initialName === "string";

  async function onSave() {
    if (name.trim().length < 2) {
      toast.error("Voice name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        language: language.trim() ? language.trim() : null,
        description: description.trim() ? description.trim() : null,
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Could not update voice");
      return;
    }

    onVoiceUpdated?.({
      name: name.trim(),
      language: language.trim() ? language.trim() : null,
      description: description.trim() ? description.trim() : null,
    });
    toast.success("Voice updated");
    setMenuOpen(false);
    setEditOpen(false);
    router.refresh();
  }

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
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 cursor-pointer p-0 disabled:pointer-events-auto disabled:cursor-not-allowed"
            aria-label="Voice settings"
            title={disabled ? (disabledReason || "Actions are unavailable while training is in progress.") : undefined}
            disabled={disabled}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canEdit ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                setEditOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit details
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
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
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete voice
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit voice</DialogTitle>
            <DialogDescription>Update voice name, language, and notes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor={`edit-name-${voiceId}`}>Voice name</Label>
              <Input
                id={`edit-name-${voiceId}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Voice name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`edit-lang-${voiceId}`}>Language</Label>
              <Input
                id={`edit-lang-${voiceId}`}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g., en"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`edit-notes-${voiceId}`}>Notes</Label>
              <Textarea
                id={`edit-notes-${voiceId}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={() => void onSave()} disabled={saving} className="rounded-full">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageUploader
        ref={uploaderRef}
        headless
        type="voice_cover_image"
        voiceProfileId={voiceId}
        onComplete={() => {
          onCoverReplaced?.();
          router.refresh();
        }}
      />

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
