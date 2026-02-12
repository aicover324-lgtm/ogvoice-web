import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RestoreVoiceButton, PurgeVoiceButton } from "@/components/app/trash-actions";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceCoverThumb } from "@/components/app/voice-cover-thumb";
import { AlertTriangle, Clock3, Trash2 } from "lucide-react";

const TRASH_RETENTION_DAYS = 2;

function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function daysLeftUntilPurge(deletedAt: Date | null, retentionDays: number) {
  if (!deletedAt) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const ageDays = Math.floor((Date.now() - deletedAt.getTime()) / msPerDay);
  return Math.max(0, retentionDays - ageDays);
}

export default async function TrashPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const voices = await prisma.voiceProfile.findMany({
    where: { userId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: {
      assets: { where: { type: "dataset_audio" }, select: { fileSize: true } },
    },
  });

  const totalDatasetBytes = voices.reduce((sum, v) => sum + v.assets.reduce((acc, a) => acc + a.fileSize, 0), 0);
  const aboutToDelete = voices.filter((v) => {
    const left = daysLeftUntilPurge(v.deletedAt, TRASH_RETENTION_DAYS);
    return left !== null && left <= 0;
  }).length;

  return (
    <main className="og-app-main">
      <PageHeader title="Trash" />

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#0f1831] p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-200">
            Deleted voices stay here for {TRASH_RETENTION_DAYS} days. You can restore them or remove them forever.
          </p>
          <Link href="/app/voices" className="inline-flex h-9 items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10">
            Back to Clone Voice
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#101b37] p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Deleted Voices</div>
            <div className="mt-1 text-xl font-semibold text-white">{voices.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#101b37] p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Dataset Size</div>
            <div className="mt-1 text-xl font-semibold text-white">{formatBytes(totalDatasetBytes)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#101b37] p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Needs Attention</div>
            <div className="mt-1 text-xl font-semibold text-amber-200">{aboutToDelete}</div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4">
        {voices.length === 0 ? (
          <Card className="rounded-2xl border-white/10 bg-[#101a35] p-6">
            <div className="text-sm font-semibold text-white">Trash is empty</div>
            <p className="mt-2 text-sm text-slate-300">You have no deleted voices.</p>
          </Card>
        ) : (
          <>
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Voices moved to trash are permanently deleted after two days.
            </div>
            {voices.map((v) => {
              const bytes = v.assets.reduce((acc, a) => acc + a.fileSize, 0);
              const left = daysLeftUntilPurge(v.deletedAt, TRASH_RETENTION_DAYS);
              const purgeLabel =
                left === null ? null : left > 0 ? `Auto-delete in ${left}d` : "Ready to auto-delete";
              const badgeVariant = left !== null && left <= 0 ? "destructive" : "outline";
              return (
                <Card key={v.id} className="rounded-2xl border-white/10 bg-[#101a35] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex items-center gap-3">
                        <VoiceCoverThumb voiceId={v.id} size={44} className="overflow-hidden rounded-full border border-white/15" />
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>
                            {v.name}
                          </div>
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{v.language || "Language not set"}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {purgeLabel ? (
                          <Badge variant={badgeVariant} className={left !== null && left <= 0 ? "gap-1" : undefined}>
                            {left !== null && left <= 0 ? <AlertTriangle className="h-3 w-3" /> : null}
                            {purgeLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {v.language || "Language not set"} · dataset {formatBytes(bytes)}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
                        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                        Deleted: {v.deletedAt ? new Date(v.deletedAt).toLocaleString() : "-"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <RestoreVoiceButton voiceId={v.id} />
                      <PurgeVoiceButton voiceId={v.id} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </>
        )}
      </div>

      {voices.length > 0 ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <span className="inline-flex items-center gap-1.5 font-semibold"><Trash2 className="h-4 w-4" /> Permanent deletion cannot be undone.</span>
        </div>
      ) : null}
    </main>
  );
}
