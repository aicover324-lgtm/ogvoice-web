"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  Download,
  FileAudio,
  LoaderCircle,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
import { useGlobalMediaPlayer, type GlobalMediaTrack } from "@/components/app/global-media-player-provider";

export type LibraryItem = {
  jobId: string;
  assetId: string;
  fileName: string;
  isFavorite: boolean;
  voiceId: string;
  voiceName: string;
  createdAt: string;
};

type DateFilter = "all" | "7d" | "30d" | "90d";
type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type TabKey = "all" | "favorites";

export function MyLibraryPanel({
  initialItems,
  initialAutoPlayAssetId,
}: {
  initialItems: LibraryItem[];
  initialAutoPlayAssetId?: string | null;
}) {
  const { activeTrack, playingAssetId, loadingAssetId, toggleTrack, closePlayer } = useGlobalMediaPlayer();

  const [items, setItems] = React.useState<LibraryItem[]>(initialItems);
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(null);
  const [editingFileName, setEditingFileName] = React.useState("");
  const [savingAssetId, setSavingAssetId] = React.useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = React.useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = React.useState(false);
  const [zipExporting, setZipExporting] = React.useState(false);
  const [focusedAssetId, setFocusedAssetId] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<TabKey>("all");
  const [query, setQuery] = React.useState("");
  const [voiceFilter, setVoiceFilter] = React.useState<string>("all");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [sortBy, setSortBy] = React.useState<SortKey>("newest");

  const [favoriteAssetIds, setFavoriteAssetIds] = React.useState<Set<string>>(
    new Set(initialItems.filter((item) => item.isFavorite).map((item) => item.assetId))
  );
  const [favoritingAssetIds, setFavoritingAssetIds] = React.useState<Set<string>>(new Set());
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(new Set());

  const favoriteAssetIdsRef = React.useRef(favoriteAssetIds);
  const autoPlayAttemptedRef = React.useRef<string | null>(null);
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map());

  React.useEffect(() => {
    favoriteAssetIdsRef.current = favoriteAssetIds;
  }, [favoriteAssetIds]);

  const optionStyle = React.useMemo(
    () => ({ color: "#0f172a", backgroundColor: "#ffffff" }),
    []
  );

  const voiceOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const item of items) {
      if (!byId.has(item.voiceId)) byId.set(item.voiceId, item.voiceName);
    }
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const visibleItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = items.filter((item) => {
      if (tab === "favorites" && !favoriteAssetIds.has(item.assetId)) return false;
      if (voiceFilter !== "all" && item.voiceId !== voiceFilter) return false;
      if (!matchesDateFilter(item.createdAt, dateFilter)) return false;
      if (!q) return true;
      return item.fileName.toLowerCase().includes(q) || item.voiceName.toLowerCase().includes(q);
    });

    next = next.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "name_asc") return a.fileName.localeCompare(b.fileName);
      return b.fileName.localeCompare(a.fileName);
    });

    return next;
  }, [dateFilter, favoriteAssetIds, items, query, sortBy, tab, voiceFilter]);

  const playQueueItems = React.useMemo(() => {
    return visibleItems.length > 0 ? visibleItems : items;
  }, [items, visibleItems]);

  const playQueueTracks = React.useMemo(() => playQueueItems.map(toMediaTrack), [playQueueItems]);

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedAssetIds.has(item.assetId));

  const favoriteCount = React.useMemo(
    () => items.filter((item) => favoriteAssetIds.has(item.assetId)).length,
    [favoriteAssetIds, items]
  );

  function beginRename(item: LibraryItem) {
    setEditingAssetId(item.assetId);
    setEditingFileName(item.fileName);
  }

  function cancelRename() {
    setEditingAssetId(null);
    setEditingFileName("");
  }

  async function applyFavorite(assetId: string, nextFavorite: boolean, opts?: { showUndo?: boolean }) {
    const showUndo = opts?.showUndo !== false;
    const wasFavorite = favoriteAssetIdsRef.current.has(assetId);
    if (wasFavorite === nextFavorite) return;

    setFavoritingAssetIds((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });

    setFavoriteAssetIds((prev) => {
      const next = new Set(prev);
      if (nextFavorite) next.add(assetId);
      else next.delete(assetId);
      return next;
    });

    try {
      const res = await fetch("/api/generate/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, isFavorite: nextFavorite }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Could not update favorite.");
      }

      if (showUndo) {
        toast.message(nextFavorite ? "Added to favorites." : "Removed from favorites.", {
          duration: 4500,
          action: {
            label: "Undo",
            onClick: () => {
              void applyFavorite(assetId, wasFavorite, { showUndo: false });
            },
          },
        });
      }
    } catch (e) {
      setFavoriteAssetIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(assetId);
        else next.delete(assetId);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Could not update favorite.");
    } finally {
      setFavoritingAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  }

  function toggleFavorite(assetId: string) {
    const wasFavorite = favoriteAssetIds.has(assetId);
    void applyFavorite(assetId, !wasFavorite);
  }

  function toggleSelected(assetId: string) {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const item of visibleItems) next.delete(item.assetId);
      } else {
        for (const item of visibleItems) next.add(item.assetId);
      }
      return next;
    });
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

  async function removeOneByAssetId(assetId: string) {
    const item = items.find((x) => x.assetId === assetId);
    if (!item) return { ok: false, reason: "NOT_FOUND" } as const;

    const res = await fetch("/api/generate/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false, reason: json?.error?.message || "Could not delete file." } as const;
    }

    if (activeTrack?.assetId === assetId) {
      closePlayer();
    }

    setItems((prev) => prev.filter((x) => x.assetId !== assetId));
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(assetId);
      return next;
    });
    setFavoriteAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(assetId);
      return next;
    });
    setFavoritingAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(assetId);
      return next;
    });
    if (editingAssetId === assetId) {
      setEditingAssetId(null);
      setEditingFileName("");
    }
    return { ok: true } as const;
  }

  async function deleteOne(item: LibraryItem) {
    const confirmed = window.confirm(`Delete \"${item.fileName}\" from your library?`);
    if (!confirmed) return;

    setDeletingAssetId(item.assetId);
    try {
      const result = await removeOneByAssetId(item.assetId);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      toast.success("File removed from library.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete file.");
    } finally {
      setDeletingAssetId(null);
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selectedAssetIds).filter((id) => items.some((item) => item.assetId === id));
    if (ids.length === 0) return;
    const confirmed = window.confirm(`Delete ${ids.length} selected track(s) from your library?`);
    if (!confirmed) return;

    setBatchDeleting(true);
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      const result = await removeOneByAssetId(id);
      if (result.ok) success += 1;
      else failed += 1;
    }

    setBatchDeleting(false);
    if (success > 0) toast.success(`${success} track(s) removed.`);
    if (failed > 0) toast.error(`${failed} track(s) could not be removed.`);
  }

  function downloadSelected() {
    const ids = Array.from(selectedAssetIds).filter((id) => items.some((item) => item.assetId === id));
    if (ids.length === 0) return;

    ids.forEach((id, idx) => {
      window.setTimeout(() => {
        const frame = document.createElement("iframe");
        frame.style.display = "none";
        frame.src = `/api/assets/${encodeURIComponent(id)}?download=1`;
        document.body.appendChild(frame);
        window.setTimeout(() => {
          frame.remove();
        }, 25000);
      }, idx * 220);
    });

    toast.success(`Download started for ${ids.length} track(s).`);
  }

  async function exportSelectedAsZip() {
    const ids = Array.from(selectedAssetIds).filter((id) => items.some((item) => item.assetId === id));
    if (ids.length === 0) return;

    setZipExporting(true);
    try {
      const res = await fetch("/api/generate/library/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: ids }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || "Could not export ZIP.");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const fileName = fileNameMatch?.[1] || `og-voice-library-${Date.now()}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 12000);

      toast.success(`ZIP export is ready (${ids.length} track(s)).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export ZIP.");
    } finally {
      setZipExporting(false);
    }
  }

  function playItem(item: LibraryItem) {
    void toggleTrack(toMediaTrack(item), playQueueTracks);
  }

  React.useEffect(() => {
    const targetAssetId = (initialAutoPlayAssetId || "").trim();
    if (!targetAssetId) return;
    if (autoPlayAttemptedRef.current === targetAssetId) return;

    const item = items.find((x) => x.assetId === targetAssetId);
    if (!item) return;

    autoPlayAttemptedRef.current = targetAssetId;
    setFocusedAssetId(targetAssetId);
    const cardEl = itemRefs.current.get(targetAssetId);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    void toggleTrack(toMediaTrack(item), playQueueTracks);
  }, [initialAutoPlayAssetId, items, playQueueTracks, toggleTrack]);

  React.useEffect(() => {
    if (!focusedAssetId) return;
    const t = window.setTimeout(() => setFocusedAssetId(null), 1800);
    return () => window.clearTimeout(t);
  }, [focusedAssetId]);

  return (
    <section
      className={
        "rounded-2xl border border-white/10 bg-[#101a35] p-4 md:p-5" +
        (activeTrack ? " pb-28 md:pb-32" : "")
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">Your generated tracks in a music-library view.</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/10 text-slate-100">{items.length} tracks</Badge>
          <Badge variant="outline" className="border-amber-300/45 bg-amber-400/10 text-amber-200">
            {favoriteCount} favorites
          </Badge>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "all" ? "default" : "outline"}
          className={
            (tab === "all" ? "bg-cyan-500/25 text-cyan-100 hover:bg-cyan-500/32" : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10") +
            " rounded-full cursor-pointer"
          }
          onClick={() => setTab("all")}
        >
          All
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "favorites" ? "default" : "outline"}
          className={
            (tab === "favorites"
              ? "bg-amber-500/25 text-amber-100 hover:bg-amber-500/32"
              : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10") +
            " rounded-full cursor-pointer"
          }
          onClick={() => setTab("favorites")}
        >
          <Star className="mr-1.5 h-3.5 w-3.5" />
          Favorites
        </Button>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by track or voice..."
            className="h-10 border-white/15 bg-white/5 pl-9 text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <select
          value={voiceFilter}
          onChange={(e) => setVoiceFilter(e.target.value)}
          className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
          aria-label="Filter by voice"
        >
          <option value="all" style={optionStyle}>All voices</option>
          {voiceOptions.map((v) => (
            <option key={v.id} value={v.id} style={optionStyle}>
              {v.name}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
          aria-label="Filter by date"
        >
          <option value="all" style={optionStyle}>All time</option>
          <option value="7d" style={optionStyle}>Last 7 days</option>
          <option value="30d" style={optionStyle}>Last 30 days</option>
          <option value="90d" style={optionStyle}>Last 90 days</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
          aria-label="Sort tracks"
        >
          <option value="newest" style={optionStyle}>Newest first</option>
          <option value="oldest" style={optionStyle}>Oldest first</option>
          <option value="name_asc" style={optionStyle}>Name A-Z</option>
          <option value="name_desc" style={optionStyle}>Name Z-A</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="h-4 w-4 accent-cyan-400"
            disabled={visibleItems.length === 0}
          />
          Select visible
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{selectedAssetIds.size} selected</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
            onClick={downloadSelected}
            disabled={selectedAssetIds.size === 0 || zipExporting}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download Selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 cursor-pointer"
            onClick={() => {
              void exportSelectedAsZip();
            }}
            disabled={selectedAssetIds.size === 0 || zipExporting || batchDeleting}
          >
            {zipExporting ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Archive className="mr-1.5 h-3.5 w-3.5" />}
            Export ZIP
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full border-rose-300/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 cursor-pointer"
            onClick={() => {
              void deleteSelected();
            }}
            disabled={selectedAssetIds.size === 0 || batchDeleting}
          >
            {batchDeleting ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Delete Selected
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No tracks in your library yet. Create a cover to see it here.
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No tracks match your current filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleItems.map((item) => {
            const isEditing = editingAssetId === item.assetId;
            const busy = savingAssetId === item.assetId || deletingAssetId === item.assetId || batchDeleting;
            const loadingPlay = loadingAssetId === item.assetId;
            const playing = playingAssetId === item.assetId;
            const active = activeTrack?.assetId === item.assetId;
            const favorite = favoriteAssetIds.has(item.assetId);
            const favoriteBusy = favoritingAssetIds.has(item.assetId);
            const selected = selectedAssetIds.has(item.assetId);

            return (
              <article
                key={item.assetId}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.assetId, el);
                  else itemRefs.current.delete(item.assetId);
                }}
                className={
                  "relative flex min-h-[360px] flex-col overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-3 transition-colors " +
                  (focusedAssetId === item.assetId
                    ? "border-cyan-300/60 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                    : active
                      ? "border-fuchsia-300/45"
                      : selected
                        ? "border-cyan-300/35"
                        : "border-white/10")
                }
              >
                <div className="mb-2 flex items-center justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(item.assetId)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    Select
                  </label>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={
                        "h-8 w-8 rounded-lg border cursor-pointer " +
                        (favorite
                          ? "border-amber-300/45 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                          : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10")
                      }
                      onClick={() => {
                        toggleFavorite(item.assetId);
                      }}
                      disabled={favoriteBusy || busy}
                      aria-label={favorite ? "Remove favorite" : "Add favorite"}
                    >
                      {favoriteBusy ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className={"h-4 w-4 " + (favorite ? "fill-amber-300" : "")} />
                      )}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
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
                </div>

                <div className="relative overflow-hidden rounded-xl border border-white/10">
                  <VoiceLibraryCover voiceId={item.voiceId} alt={item.voiceName} />
                </div>

                <div className="mt-3 flex min-h-0 flex-1 flex-col">
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-lg font-semibold leading-tight text-slate-100">{item.fileName}</div>
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
                        className="h-8 w-8 rounded-lg cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                        disabled={busy}
                        onClick={() => {
                          void saveRename(item.assetId);
                        }}
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                        disabled={busy}
                        onClick={cancelRename}
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-2 text-sm text-slate-200">{item.voiceName}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatCreated(item.createdAt)}</div>

                  <div className="mt-auto pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        playItem(item);
                      }}
                      className={
                        "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors " +
                        (playing
                          ? "border-fuchsia-300/45 bg-fuchsia-500/20 text-fuchsia-100"
                          : active
                            ? "border-fuchsia-300/35 bg-fuchsia-500/12 text-fuchsia-100"
                            : "border-cyan-300/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/22") +
                        " cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                      }
                      disabled={busy || loadingPlay}
                      aria-label={playing ? "Pause" : "Play"}
                    >
                      {loadingPlay ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                      ) : playing ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VoiceLibraryCover({ voiceId, alt }: { voiceId: string; alt: string }) {
  const [ok, setOk] = React.useState(true);
  const src = `/api/voices/${encodeURIComponent(voiceId)}/cover`;

  if (!ok) {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 text-slate-200">
        <FileAudio className="h-8 w-8" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="aspect-[3/4] w-full object-cover"
      onError={() => setOk(false)}
    />
  );
}

function toMediaTrack(item: LibraryItem): GlobalMediaTrack {
  return {
    assetId: item.assetId,
    fileName: item.fileName,
    voiceId: item.voiceId,
    voiceName: item.voiceName,
  };
}

function formatCreated(iso: string) {
  return new Date(iso).toLocaleString();
}

function matchesDateFilter(iso: string, filter: DateFilter) {
  if (filter === "all") return true;
  const createdMs = new Date(iso).getTime();
  if (!Number.isFinite(createdMs)) return false;
  const now = Date.now();
  const ageMs = now - createdMs;
  const day = 24 * 60 * 60 * 1000;
  if (filter === "7d") return ageMs <= 7 * day;
  if (filter === "30d") return ageMs <= 30 * day;
  return ageMs <= 90 * day;
}
