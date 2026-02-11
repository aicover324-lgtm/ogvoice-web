"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DraftDatasetUploaderWithReplace } from "@/components/app/draft-dataset-uploader-with-replace";
import { ImageUploader } from "@/components/app/image-uploader";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/app/premium-card";

const schema = z.object({
  name: z.string().min(2).max(60),
  language: z.string().max(32).optional(),
  description: z.string().max(500).optional(),
});

export default function NewVoicePage() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);
  const [datasetAssetId, setDatasetAssetId] = React.useState<string | null>(null);
  const [coverAssetId, setCoverAssetId] = React.useState<string | null>(null);
  const [resetKey, setResetKey] = React.useState(0);
  const formRef = React.useRef<HTMLFormElement | null>(null);

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            New Voice Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your singing voice recording.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={cleaning}
          onClick={() => {
            void (async () => {
              setCleaning(true);
              try {
                const [a, b] = await Promise.all([
                  fetch("/api/uploads/draft", { method: "DELETE" }),
                  fetch("/api/uploads/draft-cover", { method: "DELETE" }),
                ]);
                const aj = await a.json().catch(() => null);
                const bj = await b.json().catch(() => null);
                if (!a.ok || !aj?.ok) throw new Error(aj?.error?.message || "Could not clean voice file");
                if (!b.ok || !bj?.ok) throw new Error(bj?.error?.message || "Could not clean cover image");
                setDatasetAssetId(null);
                setCoverAssetId(null);
                setResetKey((k) => k + 1);
                formRef.current?.reset();
                toast.success("Cleaned. Start fresh.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Clean failed");
              } finally {
                setCleaning(false);
              }
            })();
          }}
        >
          {cleaning ? "Cleaning..." : "Clean"}
        </Button>
      </div>

      <form ref={formRef} onSubmit={createVoice} className="mt-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <DraftDatasetUploaderWithReplace
            key={`voice-${resetKey}`}
            title="1. Singing Voice"
            onDraftChange={(asset) => {
              setDatasetAssetId(asset?.id ?? null);
            }}
          />

          <PremiumCard className="p-6">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>2. Cover Image</div>
                <Badge variant={coverAssetId ? "secondary" : "outline"}>{coverAssetId ? "uploaded" : "optional"}</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                <ImageUploader
                  key={`cover-${resetKey}`}
                  type="voice_cover_image"
                  trigger="frame"
                  frameHint={null}
                  footerHint={null}
                  preview={{
                    src: "/api/uploads/draft-cover/image",
                    alt: "Cover",
                    variant: "cover",
                    width: "100%",
                    height: 288,
                  }}
                  onAssetCreated={(asset) => setCoverAssetId(asset.id)}
                />
                <div className="text-xs text-muted-foreground">Upload a cover image</div>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard className="p-6">
            <div>
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
          </PremiumCard>
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
