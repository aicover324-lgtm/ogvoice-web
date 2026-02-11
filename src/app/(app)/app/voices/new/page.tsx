"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DraftDatasetUploaderWithReplace } from "@/components/app/draft-dataset-uploader-with-replace";
import { ImageUploader } from "@/components/app/image-uploader";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  name: z.string().min(2).max(60),
  language: z.string().max(32).optional(),
  description: z.string().max(500).optional(),
});

export default function NewVoicePage() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [datasetAssetId, setDatasetAssetId] = React.useState<string | null>(null);
  const [coverAssetId, setCoverAssetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // If user refreshes the page, we can still attach the last drafted cover.
    (async () => {
      const res = await fetch("/api/uploads/draft-cover", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return;
      const asset = (json.data?.asset || null) as { id?: string } | null;
      if (asset?.id) setCoverAssetId(String(asset.id));
    })();
  }, []);

  async function createVoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!datasetAssetId) {
      toast.error("Upload your singing voice recording first.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      language: String(form.get("language") || "") || undefined,
      description: String(form.get("description") || "") || undefined,
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      toast.error("Please provide a name (2+ chars).");
      return;
    }

    setCreating(true);
    const res = await fetch("/api/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed.data, datasetAssetId, coverAssetId: coverAssetId || undefined }),
    });
    const json = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Failed to create voice");
      return;
    }

    toast.success("Voice created");
    router.push(`/app/voices/${json.data.voice.id}`);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          New Voice Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your singing voice recording.
        </p>
      </div>

      <form onSubmit={createVoice} className="mt-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <DraftDatasetUploaderWithReplace
            title="1. Singing Voice"
            onDraftChange={(asset) => {
              setDatasetAssetId(asset?.id ?? null);
            }}
          />

          <Card className="relative overflow-hidden rounded-2xl border border-black/5 bg-white/75 p-6 shadow-[0_12px_32px_rgba(2,8,23,0.10)] backdrop-blur-md dark:border-white/10 dark:bg-background/35 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_10%_0%,rgba(0,150,255,0.07),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(120,140,255,0.06),transparent_55%)] dark:bg-[radial-gradient(80%_60%_at_10%_0%,rgba(0,180,255,0.16),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(160,120,255,0.12),transparent_55%)]" />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/7 dark:ring-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>2. Cover Image</div>
                <Badge variant={coverAssetId ? "secondary" : "outline"}>{coverAssetId ? "uploaded" : "optional"}</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                <ImageUploader
                  type="voice_cover_image"
                  trigger="frame"
                  preview={{
                    src: "/api/uploads/draft-cover/image",
                    alt: "Cover",
                    variant: "cover",
                    width: "100%",
                    height: 288,
                  }}
                  onAssetCreated={(asset) => setCoverAssetId(asset.id)}
                />
                <div className="text-xs text-muted-foreground">
                  Click the cover to upload. You can replace it later from the voice card menu.
                </div>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden rounded-2xl border border-black/5 bg-white/75 p-6 shadow-[0_12px_32px_rgba(2,8,23,0.10)] backdrop-blur-md dark:border-white/10 dark:bg-background/35 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_10%_0%,rgba(0,150,255,0.08),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(255,60,210,0.06),transparent_55%)] dark:bg-[radial-gradient(80%_60%_at_10%_0%,rgba(0,210,255,0.16),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(255,60,210,0.12),transparent_55%)]" />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/7 dark:ring-white/10" />
            <div className="relative">
              <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>3. Voice Details</div>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="e.g., Studio Vocal - English" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="language">Language (optional)</Label>
                  <Input id="language" name="language" placeholder="e.g., en" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Notes (optional)</Label>
                  <Textarea id="description" name="description" placeholder="Mic, room, style, tips..." />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/22 blur-xl dark:from-cyan-500/30 dark:to-fuchsia-500/28" />
            <Button
              type="submit"
              disabled={creating || !datasetAssetId}
              className="relative h-11 rounded-full px-7 text-sm font-semibold shadow-lg shadow-black/10 dark:shadow-black/30 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Voice"}
            </Button>
          </div>
          {!datasetAssetId ? (
            <div className="text-xs text-muted-foreground">Upload your singing voice to enable “Create Voice”.</div>
          ) : null}
        </div>
      </form>
    </main>
  );
}
