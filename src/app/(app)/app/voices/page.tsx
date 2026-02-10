import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoiceActionsMenu } from "@/components/app/voice-actions-menu";

export default async function VoicesPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const voices = await prisma.voiceProfile.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assets: true, versions: true } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            AI Voices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Each voice holds its dataset and model versions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/voices/trash">Trash</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/app/voices/new">New voice</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {voices.length === 0 ? (
          <Card className="p-6">
            <div className="text-sm font-semibold">No voices yet</div>
            <p className="mt-2 text-sm text-muted-foreground">Create your first voice profile to start uploading a dataset.</p>
            <div className="mt-4">
              <Button asChild className="rounded-full">
                <Link href="/app/voices/new">Create voice</Link>
              </Button>
            </div>
          </Card>
        ) : (
          voices.map((v) => {
            return (
              <Card key={v.id} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                      {v.name}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {v.language || "Language not set"} · {v._count.assets} files · {v._count.versions} versions
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">{v._count.assets > 0 ? "dataset ready" : "no dataset"}</Badge>
                    <VoiceActionsMenu voiceId={v.id} />
                  </div>
                </div>
                <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{v.description || "No description."}</p>
                <div className="mt-5">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href={`/app/voices/${v.id}`}>Open</Link>
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
