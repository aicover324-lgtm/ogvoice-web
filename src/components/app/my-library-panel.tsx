"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LibraryItem = {
  jobId: string;
  assetId: string;
  fileName: string;
  voiceName: string;
  createdAt: string;
};

export function MyLibraryPanel({ initialItems }: { initialItems: LibraryItem[] }) {
  const [items, setItems] = React.useState<LibraryItem[]>(initialItems);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(null);
  const [editingFileName, setEditingFileName] = React.useState("");
  const [savingAssetId, setSavingAssetId] = React.useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = React.useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const selectionAnchorRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.assetId === id)));
    if (selectionAnchorRef.current && !items.some((item) => item.assetId === selectionAnchorRef.current)) {
      selectionAnchorRef.current = null;
    }
  }, [items]);

  const selectedCount = selectedIds.length;
  const allSelected = items.length > 0 && selectedCount === items.length;

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
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Could not delete file.");
      setItems((prev) => prev.filter((x) => x.assetId !== item.assetId));
      toast.success("File removed from library.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete file.");
    } finally {
      setDeletingAssetId(null);
    }
  }

  function toggleSelection(assetId: string, withRange: boolean) {
    setSelectedIds((prev) => {
      const order = items.map((item) => item.assetId);
      const clickedIndex = order.indexOf(assetId);
      if (clickedIndex < 0) return prev;
      const selected = new Set(prev);
      const nextState = !selected.has(assetId);
      const anchorId = selectionAnchorRef.current;

      if (withRange && anchorId) {
        const anchorIndex = order.indexOf(anchorId);
        if (anchorIndex >= 0) {
          const [start, end] = anchorIndex < clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
          for (const id of order.slice(start, end + 1)) {
            if (nextState) selected.add(id);
            else selected.delete(id);
          }
          return order.filter((id) => selected.has(id));
        }
      }

      if (nextState) selected.add(assetId);
      else selected.delete(assetId);
      return order.filter((id) => selected.has(id));
    });
    selectionAnchorRef.current = assetId;
  }

  function onCheckboxClick(e: React.MouseEvent<HTMLInputElement>, assetId: string) {
    e.preventDefault();
    toggleSelection(assetId, e.shiftKey);
  }

  function selectAll() {
    setSelectedIds(items.map((item) => item.assetId));
    selectionAnchorRef.current = items[0]?.assetId ?? null;
  }

  function clearSelection() {
    setSelectedIds([]);
    selectionAnchorRef.current = null;
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`Delete ${selectedIds.length} selected tracks from your library?`);
    if (!confirmed) return;

    setBulkDeleting(true);
    let successCount = 0;
    for (const assetId of selectedIds) {
      try {
        const res = await fetch("/api/generate/library", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) continue;
        successCount += 1;
        setItems((prev) => prev.filter((item) => item.assetId !== assetId));
      } catch {
        // continue deleting
      }
    }
    setSelectedIds([]);
    selectionAnchorRef.current = null;
    setBulkDeleting(false);
    if (successCount > 0) toast.success(`${successCount} track${successCount > 1 ? "s" : ""} removed.`);
    else toast.error("Could not delete selected tracks.");
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#101a35] p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-white" style={{ fontFamily: "var(--font-heading)" }}>
            My Library
          </h3>
          <p className="mt-1 text-sm text-slate-300">Manage your generated tracks: rename, download, or remove.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 ? (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg border-white/20 bg-white/5 text-slate-100 hover:bg-white/10" onClick={allSelected ? clearSelection : selectAll}>
                {allSelected ? "Clear selection" : "Select all"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-red-300/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:pointer-events-auto disabled:cursor-not-allowed"
                disabled={selectedCount === 0 || bulkDeleting}
                onClick={() => void bulkDelete()}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete selected ({selectedCount})
              </Button>
            </>
          ) : null}
          <Badge variant="secondary" className="bg-white/10 text-slate-100">{items.length} tracks</Badge>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No tracks in your library yet. Create a cover to see it here.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const isEditing = editingAssetId === item.assetId;
            const busy = savingAssetId === item.assetId || deletingAssetId === item.assetId || bulkDeleting;
            const selected = selectedIds.includes(item.assetId);
            return (
              <div key={item.assetId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input value={editingFileName} onChange={(e) => setEditingFileName(e.target.value)} className="h-9 border-white/15 bg-white/5 text-slate-100" maxLength={180} />
                    <Button type="button" size="icon" className="h-9 w-9 rounded-lg cursor-pointer" disabled={busy} onClick={() => void saveRename(item.assetId)} title="Save">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg cursor-pointer" disabled={busy} onClick={cancelRename} title="Cancel">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <label className="mt-0.5 inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-cyan-400"
                          checked={selected}
                          onClick={(e) => onCheckboxClick(e, item.assetId)}
                          onChange={() => {}}
                          disabled={busy}
                        />
                      </label>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{item.fileName}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{item.voiceName} · {formatAgo(item.createdAt)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-white/20 bg-white/5 text-slate-100 hover:bg-white/10">
                        <Link href={`/api/assets/${encodeURIComponent(item.assetId)}`} target="_blank">Open</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-white/20 bg-white/5 text-slate-100 hover:bg-white/10">
                        <Link href={`/api/assets/${encodeURIComponent(item.assetId)}`} target="_blank">
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download
                        </Link>
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-lg border-white/20 bg-white/5 text-slate-100 hover:bg-white/10" onClick={() => beginRename(item)} disabled={busy} title="Rename">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-lg border-red-300/30 bg-red-500/10 text-red-200 hover:bg-red-500/20" onClick={() => void deleteOne(item)} disabled={busy} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatAgo(iso: string) {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.floor((now - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}
