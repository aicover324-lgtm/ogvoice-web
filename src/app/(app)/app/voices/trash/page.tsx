import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RestoreVoiceButton, PurgeVoiceButton } from "@/components/app/trash-actions";
import { PageHeader } from "@/components/ui/page-header";
import { AlertTriangle } from "lucide-react";

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

  return (
    <main className="og-app-main">
      <PageHeader
        title="Trash"
        description="Deleted voices stay here for a while. You can restore them, or delete forever."
        actions={
          <Link className="text-sm underline underline-offset-4" href="/app/voices">
            Back to voices
          </Link>
        }
      />

      <div className="mt-8 grid gap-4">
        {voices.length === 0 ? (
          <>
            <Card className="p-6">
              <div className="text-sm font-semibold">Trash is empty</div>
              <p className="mt-2 text-sm text-muted-foreground">You have no deleted voices.</p>
            </Card>
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Voices moved to trash are permanently deleted after two days.
            </div>
          </>
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
                <Card key={v.id} className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                          {v.name}
                        </div>
                        {purgeLabel ? (
                          <Badge variant={badgeVariant} className={left !== null && left <= 0 ? "gap-1" : undefined}>
                            {left !== null && left <= 0 ? <AlertTriangle className="h-3 w-3" /> : null}
                            {purgeLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {v.language || "Language not set"} · dataset {formatBytes(bytes)}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
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
    </main>
  );
}
