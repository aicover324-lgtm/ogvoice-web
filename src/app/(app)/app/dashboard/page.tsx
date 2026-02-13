import Link from "next/link";
import Image from "next/image";
import { Plus, Info, Mic2, Music3 } from "lucide-react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PremiumCard } from "@/components/app/premium-card";

const ACTIVE_JOB_STATUSES: Array<"queued" | "running"> = ["queued", "running"];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [voices, recentGenerations, stats] = await Promise.all([
    prisma.voiceProfile.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        language: true,
        assets: {
          where: { type: { in: ["dataset_audio", "voice_cover_image"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, type: true },
          take: 4,
        },
        trainingJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, progress: true, errorMessage: true },
        },
        versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      },
    }),
    prisma.generationJob.findMany({
      where: { userId, status: "succeeded", outputAssetId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        progress: true,
        createdAt: true,
        outputAssetId: true,
        voiceProfile: { select: { name: true } },
      },
    }),
    prisma.$transaction([
      prisma.generationJob.count({ where: { userId, status: "succeeded" } }),
      prisma.voiceProfile.count({ where: { userId, deletedAt: null } }),
      prisma.voiceProfile.count({ where: { userId, deletedAt: null, versions: { some: {} } } }),
      prisma.trainingJob.count({ where: { userId, status: { in: ACTIVE_JOB_STATUSES }, voiceProfile: { deletedAt: null } } }),
      prisma.generationJob.count({ where: { userId, status: { in: ACTIVE_JOB_STATUSES } } }),
    ]),
  ]);

  const [totalSongs, activeVoices, readyVoices, cloningQueue, conversionQueue] = stats;

  const outputIds = recentGenerations.map((g) => g.outputAssetId).filter((id): id is string => !!id);
  const outputAssets =
    outputIds.length > 0
      ? await prisma.uploadAsset.findMany({
          where: { id: { in: outputIds }, userId, type: "generated_output" },
          select: { id: true, fileName: true },
        })
      : [];
  const outputById = new Map(outputAssets.map((a) => [a.id, a]));
  const recentConversionRows = recentGenerations.filter((row) => !!(row.outputAssetId && outputById.has(row.outputAssetId)));

  return (
    <main className="og-app-main">
      <PageHeader
        title="Dashboard"
        description="Track your cloned voices and recent conversions."
        actions={
          <Button asChild className="og-btn-gradient rounded-full cursor-pointer px-5">
            <Link href="/app/create/new">
              <Plus className="mr-2 h-4 w-4" />
              Create New Voice
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {voices.map((voice) => {
                const latestJob = voice.trainingJobs[0] || null;
                const hasRecord = voice.assets.some((a) => a.type === "dataset_audio");
                const hasCover = voice.assets.some((a) => a.type === "voice_cover_image");
                const isReady = !!voice.versions[0];
                const isCloning = latestJob?.status === "queued" || latestJob?.status === "running";
                const isFailed = latestJob?.status === "failed";

                const status = isReady
                  ? { label: "Ready", className: "og-chip-cyan" }
                  : isCloning
                    ? { label: `Cloning ${latestJob?.progress || 0}%`, className: "og-chip-gradient" }
                    : isFailed
                      ? { label: "Needs retry", className: "bg-red-500/10 text-red-300 border border-red-500/30" }
                      : hasRecord
                        ? { label: "Pending", className: "og-chip-muted" }
                        : { label: "Waiting record", className: "bg-amber-500/10 text-amber-300 border border-amber-500/30" };

                return (
                  <PremiumCard key={voice.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20">
                        {hasCover ? (
                          <Image
                            src={`/api/voices/${encodeURIComponent(voice.id)}/cover`}
                            alt={`${voice.name} cover`}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-base font-semibold">
                            {initials(voice.name)}
                          </div>
                        )}
                      </div>
                      <span className={`og-chip-soft text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                    </div>

                    <div className="mt-4 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                      {voice.name}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{voice.language || "Language not set"}</p>

                    {isCloning ? (
                      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
                          style={{ width: `${Math.max(8, latestJob?.progress || 0)}%` }}
                        />
                      </div>
                    ) : null}

                    <div className="mt-4">
                      {isReady ? (
                        <Button asChild className="w-full rounded-full cursor-pointer">
                          <Link href={`/app/generate?voiceId=${encodeURIComponent(voice.id)}`}>Use Voice</Link>
                        </Button>
                      ) : hasRecord ? (
                        <Button asChild variant="outline" className="w-full rounded-full cursor-pointer">
                          <Link href="/app/voices">Open Clone Voice</Link>
                        </Button>
                      ) : (
                        <Button asChild variant="outline" className="w-full rounded-full cursor-pointer">
                          <Link href="/app/create/new">Add Singing Record</Link>
                        </Button>
                      )}
                    </div>
                  </PremiumCard>
                );
              })}

              <Link
                href="/app/create/new"
                className="group rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 transition-colors hover:border-cyan-400/55"
              >
                <div className="grid h-full min-h-[220px] place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition-colors group-hover:text-cyan-300">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-sm font-semibold">New Voice Project</div>
                    <div className="mt-1 text-xs text-muted-foreground">Create a new voice profile</div>
                  </div>
                </div>
              </Link>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
                Recent Conversions
              </h2>
              <Link href="/app/generate" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                Open generate
              </Link>
            </div>

            <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="grid grid-cols-[1.6fr_0.9fr_0.8fr_1fr] border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <div>Song / Voice</div>
                <div>Date</div>
                <div>Status</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {recentConversionRows.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">No conversions yet.</div>
                ) : (
                  recentConversionRows.map((row) => {
                    const outputAssetId = row.outputAssetId;
                    if (!outputAssetId) return null;
                    const output = outputById.get(outputAssetId);
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.6fr_0.9fr_0.8fr_1fr] items-center border-b border-white/10 px-4 py-4 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{output?.fileName || "Converted track"}</div>
                          <div className="truncate text-xs text-muted-foreground">{row.voiceProfile.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</div>
                        <div>
                          <span className={`og-chip-soft text-xs ${statusChipClass(row.status)}`}>{statusLabel(row.status)}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/app/library?playAssetId=${encodeURIComponent(outputAssetId)}`}
                            className="rounded-full border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-300 hover:text-cyan-100"
                          >
                            Play
                          </Link>
                          <Link
                            href={`/api/assets/${encodeURIComponent(outputAssetId)}`}
                            target="_blank"
                            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
                          >
                            Download
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <PremiumCard className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quick Statistics</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatTile label="Total Songs" value={totalSongs} icon={<Music3 className="h-4 w-4" />} />
              <StatTile label="Active Voices" value={activeVoices} icon={<Mic2 className="h-4 w-4" />} />
              <StatTile label="Ready Voices" value={readyVoices} icon={<Mic2 className="h-4 w-4" />} />
              <StatTile label="Cloning Now" value={cloningQueue} icon={<Mic2 className="h-4 w-4" />} />
            </div>
          </PremiumCard>

          <PremiumCard className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">System Status</div>
            <div className="mt-4 space-y-4">
              <StatusBar
                label="Cloning Queue"
                value={Math.min(100, cloningQueue * 20)}
                valueLabel={`${cloningQueue}`}
                tone="cyan"
              />
              <StatusBar
                label="Conversion Queue"
                value={Math.min(100, conversionQueue * 20)}
                valueLabel={`${conversionQueue}`}
                tone="fuchsia"
              />
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
                Info
              </div>
              <span
                title="Keep singing records clean and dry ! This improves voice cloning and conversion quality."
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-cyan-200"
              >
                <Info className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Keep singing records clean and dry ! This improves voice cloning and conversion quality.
            </p>
          </PremiumCard>
        </aside>
      </div>
    </main>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{label}</span>
        <span>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function StatusBar({
  label,
  value,
  valueLabel,
  tone,
}: {
  label: string;
  value: number;
  valueLabel: string;
  tone: "amber" | "cyan" | "fuchsia";
}) {
  const barClass =
    tone === "amber"
      ? "bg-gradient-to-r from-amber-400 to-amber-500"
      : tone === "fuchsia"
        ? "bg-gradient-to-r from-fuchsia-400 to-fuchsia-500"
        : "bg-gradient-to-r from-cyan-400 to-cyan-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{valueLabel}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(4, value)}%` }} />
      </div>
    </div>
  );
}

function statusLabel(status: "queued" | "running" | "succeeded" | "failed") {
  if (status === "queued") return "Preparing";
  if (status === "running") return "Converting";
  if (status === "succeeded") return "Done";
  return "Failed";
}

function statusChipClass(status: "queued" | "running" | "succeeded" | "failed") {
  if (status === "succeeded") return "og-chip-cyan";
  if (status === "running") return "og-chip-gradient";
  if (status === "queued") return "og-chip-muted";
  return "bg-red-500/10 text-red-300 border border-red-500/30";
}

function initials(name: string) {
  const chunks = name.trim().split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return "VC";
  if (chunks.length === 1) return chunks[0]!.slice(0, 2).toUpperCase();
  return `${chunks[0]![0] || ""}${chunks[1]![0] || ""}`.toUpperCase();
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
