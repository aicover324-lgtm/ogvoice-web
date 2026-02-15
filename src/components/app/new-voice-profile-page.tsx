"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DraftDatasetUploaderWithReplace } from "@/components/app/draft-dataset-uploader-with-replace";
import { DatasetQualityGuide } from "@/components/app/dataset-quality-guide";
import { ImageUploader } from "@/components/app/image-uploader";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/app/premium-card";

const schema = z.object({
  name: z.string().min(2).max(60),
  language: z.string().max(32).optional(),
  description: z.string().max(500).optional(),
});

export function NewVoiceProfilePage() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);
  const [datasetAssetId, setDatasetAssetId] = React.useState<string | null>(null);
  const [coverAssetId, setCoverAssetId] = React.useState<string | null>(null);
  const [resetKey, setResetKey] = React.useState(0);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const [nameValue, setNameValue] = React.useState("");

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
    router.push(`/app/voices`);
    router.refresh();
  }

  const ready = !!datasetAssetId && nameValue.trim().length >= 2;
  const canSubmit = ready && !creating;

  return (
    <main className="og-app-main">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d152d] p-5 md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(6,182,212,0.14),transparent_50%),radial-gradient(circle_at_82%_0%,rgba(217,70,239,0.12),transparent_44%)]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>
                Create Voice
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Upload your singing record, add an optional cover image, and choose a clear name. Then create your voice in one step.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10">
                <Link href="/app/voices">Back to Clone Voice</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-auto"
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
                      setNameValue("");
                      toast.success("Cleaned. Start fresh.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Clean failed");
                    } finally {
                      setCleaning(false);
                    }
                  })();
                }}
              >
                {cleaning ? "Cleaning..." : "Start over"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#101b37] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">Before You Upload</h2>
          <Badge variant="outline" className="border-cyan-300/40 bg-cyan-400/10 text-cyan-200">
            Cloning rules
          </Badge>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-1.5 text-xs font-semibold text-cyan-200">
              1
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">Use only clean vocal (10-20 minutes)</div>
            <p className="mt-1 text-xs text-slate-400">Upload voice only, no music/instrumentals. Keep the recording between 10 and 20 minutes.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-1.5 text-xs font-semibold text-cyan-200">
              2
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">Keep noise low</div>
            <p className="mt-1 text-xs text-slate-400">Avoid room echo, fan noise, crowd noise, and clipped audio peaks.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-1.5 text-xs font-semibold text-cyan-200">
              3
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">One singer, steady voice</div>
            <p className="mt-1 text-xs text-slate-400">Use one voice style in one file for a more stable and natural result.</p>
          </div>
        </div>
      </section>

      <form ref={formRef} onSubmit={createVoice} className="mt-6 space-y-5">
        <DatasetQualityGuide />

        <div className="grid items-stretch gap-4 xl:grid-cols-3">
          <DraftDatasetUploaderWithReplace
            key={`voice-${resetKey}`}
            className="h-full xl:min-h-[620px]"
            title="1. Singing Record"
            onDraftChange={(asset) => {
              setDatasetAssetId(asset?.id ?? null);
            }}
          />

          <PremiumCard className="h-full border-white/10 bg-[#101b37] p-5 text-slate-100 xl:min-h-[620px]" ringClassName="ring-white/10">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  2. Cover Image
                </div>
                <Badge
                  variant={coverAssetId ? "secondary" : "outline"}
                  className={coverAssetId ? "bg-white/10 text-slate-100" : "border-white/20 text-slate-300"}
                >
                  {coverAssetId ? "Uploaded" : "Optional"}
                </Badge>
              </div>

              <div className="mt-3 grid flex-1 content-start gap-3">
                <ImageUploader
                  key={`cover-${resetKey}`}
                  type="voice_cover_image"
                  trigger="frame"
                  frameHint="Drag and drop an image, or click to upload."
                  footerHint={null}
                  preview={{
                    src: "/api/uploads/draft-cover/image",
                    alt: "Cover",
                    variant: "cover",
                    width: "100%",
                    aspectRatio: "1 / 1",
                  }}
                  onAssetCreated={(asset) => setCoverAssetId(asset.id)}
                />
                <div className="text-xs text-slate-400">Accepted: JPG, PNG, WEBP</div>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard className="h-full border-white/10 bg-[#101b37] p-5 text-slate-100 xl:min-h-[620px]" ringClassName="ring-white/10">
            <div className="flex h-full flex-col">
              <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                3. Voice Details
              </div>

              <div className="mt-4 grid flex-1 content-start gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-slate-200">Voice name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Studio Vocal - English"
                    required
                    className="border-white/15 bg-white/5 text-slate-100 placeholder:text-slate-400"
                    onInput={(e) => setNameValue((e.target as HTMLInputElement).value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="language" className="text-slate-200">Language (optional)</Label>
                  <Input
                    id="language"
                    name="language"
                    placeholder="e.g., en"
                    className="border-white/15 bg-white/5 text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-slate-200">Notes (optional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Mic, room, style, tips..."
                    className="min-h-28 border-white/15 bg-white/5 text-slate-100 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </PremiumCard>
        </div>

        <div className="pt-2">
          <div className="mx-auto w-full max-w-xl">
            <PremiumCard className="border-white/10 bg-[#101b37] p-5 text-slate-100" ringClassName="ring-white/10">
              <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                Ready Check
              </div>
              <div className="mt-3 space-y-2">
                <ReadyRow ok={!!datasetAssetId} label="Singing record" help={datasetAssetId ? "Uploaded" : "Upload a .wav record"} />
                <ReadyRow ok={nameValue.trim().length >= 2} label="Voice name" help={nameValue.trim().length >= 2 ? "Looks good" : "At least 2 characters"} />
                <ReadyRow ok={ready} label="Create voice" help={ready ? "You can create now" : "Complete the required steps"} />
              </div>

              <div className="mt-4">
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className={
                    (canSubmit
                      ? "og-btn-gradient h-11 w-full rounded-full text-sm font-semibold cursor-pointer"
                      : "h-11 w-full rounded-full border border-white/20 bg-white/5 text-slate-400") +
                    " disabled:pointer-events-auto disabled:cursor-not-allowed"
                  }
                >
                  {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {creating ? "Creating..." : "Create Voice"}
                </Button>
              </div>
            </PremiumCard>
          </div>
        </div>
      </form>
    </main>
  );
}

function ReadyRow({ ok, label, help }: { ok: boolean; label: string; help: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <span className="mt-0.5 text-slate-300">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4" />}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-100">{label}</div>
        <div className="text-[11px] text-slate-400">{help}</div>
      </div>
    </div>
  );
}
