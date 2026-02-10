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
      toast.error("Upload your dataset file first.");
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
          New voice profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the dataset first, then create the voice.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="grid gap-4">
          <DraftDatasetUploaderWithReplace
            onDraftChange={(asset) => {
              setDatasetAssetId(asset?.id ?? null);
            }}
          />

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">1b) Cover image</div>
              <Badge variant={coverAssetId ? "secondary" : "outline"}>{coverAssetId ? "uploaded" : "optional"}</Badge>
            </div>
            <div className="mt-3 grid gap-3">
              <ImageUploader
                type="voice_cover_image"
                trigger="frame"
                preview={{ src: "/api/uploads/draft-cover/image", alt: "Cover", variant: "cover", size: 176 }}
                onAssetCreated={(asset) => setCoverAssetId(asset.id)}
              />
              <div className="text-xs text-muted-foreground">
                Upload once here. You can replace it anytime later from the voice card menu.
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="text-sm font-semibold">2) Voice details</div>
          <form className="mt-4 grid gap-4" onSubmit={createVoice}>
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

            <Button type="submit" className="rounded-full" disabled={creating || !datasetAssetId}>
              {creating ? "Creating..." : "Create voice"}
            </Button>

            {!datasetAssetId ? (
              <div className="text-xs text-muted-foreground">Upload the dataset file to enable “Create voice”.</div>
            ) : null}
          </form>
        </Card>
      </div>
    </main>
  );
}
