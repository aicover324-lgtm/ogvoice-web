import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [voiceCount, assetAgg] = await Promise.all([
    prisma.voiceProfile.count({ where: { userId, deletedAt: null } }),
    prisma.uploadAsset.aggregate({ where: { userId, type: "dataset_audio" }, _sum: { fileSize: true }, _count: true }),
  ]);

  const bytes = assetAgg._sum.fileSize ?? 0;
  const files = assetAgg._count;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage datasets and voice profiles.</p>
        </div>
        <Button asChild className="rounded-full">
          <Link href="/app/voices/new">New voice</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Voices</div>
          <div className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            {voiceCount}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Dataset files</div>
          <div className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            {files}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Stored dataset bytes</div>
          <div className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            {(bytes / (1024 * 1024)).toFixed(1)} MB
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm font-semibold">Next steps</div>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <div>1) Create a voice profile.</div>
            <div>2) Upload 15-20 minutes of clean raw audio.</div>
            <div>3) Generate (placeholder flow).</div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Product status</div>
            <Badge variant="secondary">MVP</Badge>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Training is temporarily disabled while we finalize production-grade infrastructure.
          </div>
        </Card>
      </div>
    </main>
  );
}
