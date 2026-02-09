import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RestoreVoiceButton, PurgeVoiceButton } from "@/components/app/trash-actions";
import { AlertTriangle } from "lucide-react";

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
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Trash
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleted voices stay here for a while. You can restore them, or delete forever.
          </p>
        </div>
        <Link className="text-sm underline underline-offset-4" href="/app/voices">
          Back to voices
        </Link>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Automatic cleanup</div>
          <Badge variant="secondary">{env.PURGE_RETENTION_DAYS} days</Badge>
        </div>
        <Separator className="my-3" />
        <div className="text-sm text-muted-foreground">
          Voices deleted more than {env.PURGE_RETENTION_DAYS} days ago can be permanently removed by the cleanup job.
        </div>
      </Card>

      <div className="mt-8 grid gap-4">
        {voices.length === 0 ? (
          <Card className="p-6">
            <div className="text-sm font-semibold">Trash is empty</div>
            <p className="mt-2 text-sm text-muted-foreground">You have no deleted voices.</p>
          </Card>
        ) : (
          voices.map((v) => {
            const bytes = v.assets.reduce((acc, a) => acc + a.fileSize, 0);
            const left = daysLeftUntilPurge(v.deletedAt, env.PURGE_RETENTION_DAYS);
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
          })
        )}
      </div>
    </main>
  );
}
