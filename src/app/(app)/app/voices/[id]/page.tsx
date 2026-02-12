import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloneVoicePanel } from "@/components/app/clone-voice-panel";
import { VoiceActionsMenu } from "@/components/app/voice-actions-menu";
import { VoiceCoverThumb } from "@/components/app/voice-cover-thumb";
import { VoiceCoverBackdrop } from "@/components/app/voice-cover-backdrop";

export default async function VoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const voice = await prisma.voiceProfile.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      assets: { where: { type: "dataset_audio" }, orderBy: { createdAt: "desc" }, take: 1 },
      versions: { orderBy: { createdAt: "desc" }, take: 10 },
      trainingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          progress: true,
          artifactKey: true,
          errorMessage: true,
        },
      },
    },
  });
  if (!voice) notFound();

  const hasDataset = voice.assets.length > 0;
  const latestTrainingJob = voice.trainingJobs[0] || null;
  const cloneStatus = latestTrainingJob?.status ?? null;

  return (
    <main className="og-app-main">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d152d] p-5 md:p-7">
        <VoiceCoverBackdrop voiceId={voice.id} opacity={0.15} blurClassName="blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.14),transparent_48%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,0.12),transparent_44%)]" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10">
              <Link href="/app/voices">Back to Clone Voice</Link>
            </Button>
            <VoiceActionsMenu voiceId={voice.id} />
          </div>

          <div className="mt-4 flex items-start gap-3">
            <VoiceCoverThumb voiceId={voice.id} size={52} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white md:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>
                {voice.name}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                {voice.description || "No notes yet. Add a short description from the menu if you want."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{voice.language || "Language not set"}</Badge>
            <Badge variant={hasDataset ? "secondary" : "outline"}>
              {hasDataset ? "Singing record ready" : "Singing record missing"}
            </Badge>
            <span className={statusChipClass(cloneStatus)}>{statusChipLabel(cloneStatus)}</span>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <CloneVoicePanel
          voiceProfileId={voice.id}
          hasDataset={hasDataset}
          initialJobId={latestTrainingJob?.id ?? null}
          initialStatus={latestTrainingJob?.status ?? null}
          initialProgress={latestTrainingJob?.progress ?? 0}
          initialArtifactKey={latestTrainingJob?.artifactKey ?? null}
          initialErrorMessage={latestTrainingJob?.errorMessage ?? null}
        />

        <Card className="rounded-2xl border-white/10 bg-[#101a35] p-4 text-slate-100">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Model Versions</h2>
            <Badge variant="secondary" className="bg-white/10 text-slate-100">
              {voice.versions.length}
            </Badge>
          </div>

          <div className="mt-3 space-y-2.5">
            {voice.versions.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                No version yet. Start cloning to create your first one.
              </div>
            ) : (
              voice.versions.map((v) => (
                <div key={v.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">Version {v.id.slice(0, 8)}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10" asChild>
                      <a href={`/api/models/presign?versionId=${encodeURIComponent(v.id)}`} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}

function statusChipLabel(status: "queued" | "running" | "succeeded" | "failed" | null) {
  if (status === "queued") return "In queue";
  if (status === "running") return "Cloning now";
  if (status === "succeeded") return "Ready";
  if (status === "failed") return "Needs retry";
  return "Not started";
}

function statusChipClass(status: "queued" | "running" | "succeeded" | "failed" | null) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (status === "queued" || status === "running") {
    return `${base} border-cyan-400/45 bg-cyan-400/10 text-cyan-200`;
  }
  if (status === "succeeded") {
    return `${base} border-fuchsia-400/45 bg-fuchsia-500/15 text-fuchsia-200`;
  }
  if (status === "failed") {
    return `${base} border-red-400/40 bg-red-400/10 text-red-200`;
  }
  return `${base} border-white/20 bg-white/5 text-slate-300`;
}
