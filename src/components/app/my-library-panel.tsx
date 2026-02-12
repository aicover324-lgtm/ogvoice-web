"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type LibraryItem = {
  jobId: string;
  assetId: string;
  fileName: string;
  voiceName: string;
  createdAt: string;
};

export function MyLibraryPanel({ initialItems }: { initialItems: LibraryItem[] }) {
  const [items, setItems] = React.useState<LibraryItem[]>(initialItems);
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(null);
  const [editingFileName, setEditingFileName] = React.useState("");
  const [savingAssetId, setSavingAssetId] = React.useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = React.useState<string | null>(null);

  function beginRename(item: LibraryItem) {
    setEditingAssetId(item.assetId);
    setEditingFileName(item.fileName);
  }

  function cancelRename() {
    setEditingAssetId(null);
    setEditingFileName("");
  }

  async function saveRename(assetId: string) {
    const nextName = editingFileName.trim();
    if (!nextName) {
      toast.error("File name cannot be empty.");
      return;
    }

    setSavingAssetId(assetId);
    try {
      const res = await fetch("/api/generate/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, fileName: nextName }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not rename file.");
      }

      const updatedName = String(json.data.fileName || nextName);
      setItems((prev) => prev.map((item) => (item.assetId === assetId ? { ...item, fileName: updatedName } : item)));
      setEditingAssetId(null);
      setEditingFileName("");
      toast.success("File name updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename file.");
    } finally {
      setSavingAssetId(null);
    }
  }

  async function deleteOne(item: LibraryItem) {
    const confirmed = window.confirm(`Delete \"${item.fileName}\" from your library?`);
    if (!confirmed) return;

    setDeletingAssetId(item.assetId);
    try {
      const res = await fetch("/api/generate/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: item.assetId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not delete file.");
      }

      setItems((prev) => prev.filter((x) => x.assetId !== item.assetId));
      if (editingAssetId === item.assetId) {
        setEditingAssetId(null);
        setEditingFileName("");
      }
      toast.success("File removed from library.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete file.");
    } finally {
      setDeletingAssetId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#101a35] p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-300">Your generated tracks, organized like a music library.</p>
        <Badge variant="secondary" className="bg-white/10 text-slate-100">{items.length} tracks</Badge>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No tracks in your library yet. Create a cover to see it here.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const isEditing = editingAssetId === item.assetId;
            const busy = savingAssetId === item.assetId || deletingAssetId === item.assetId;

            return (
              <article
                key={item.assetId}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-3"
              >
                <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-cyan-400 to-fuchsia-400" />

                <div className="ml-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">{item.fileName}</div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                          disabled={busy}
                          aria-label="Track actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onSelect={() => beginRename(item)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/api/assets/${encodeURIComponent(item.assetId)}`} target="_blank">
                            <Download className="h-4 w-4" />
                            Download
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            void deleteOne(item);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {isEditing ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        className="h-8 border-white/15 bg-white/5 text-slate-100"
                        maxLength={180}
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        disabled={busy}
                        onClick={() => void saveRename(item.assetId)}
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        disabled={busy}
                        onClick={cancelRename}
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-2 text-xs text-slate-300">Voice: {item.voiceName}</div>
                  <div className="mt-1 text-xs text-slate-400">Created: {formatCreated(item.createdAt)}</div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatCreated(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString();
}
