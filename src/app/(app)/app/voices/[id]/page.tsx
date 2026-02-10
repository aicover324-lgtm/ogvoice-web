import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeleteVoiceButton } from "@/components/app/delete-voice-button";
import { CloneVoicePanel } from "@/components/app/clone-voice-panel";

export default async function VoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const voice = await prisma.voiceProfile.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      assets: { where: { type: "dataset_audio" }, orderBy: { createdAt: "desc" }, take: 1 },
      versions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!voice) notFound();

  const hasDataset = voice.assets.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              {voice.name}
            </h1>
            <Badge variant="secondary">{voice.language || "lang?"}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{voice.description || "No description."}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            Dataset: {hasDataset ? "uploaded" : "missing"} · replacement locked after creation
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/voices">Back</Link>
          </Button>
          <DeleteVoiceButton voiceId={voice.id} />
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Clone AI Voice</div>
            <Badge variant="secondary">training</Badge>
          </div>
          <Separator className="my-4" />

          <CloneVoicePanel voiceProfileId={voice.id} hasDataset={hasDataset} />

          <Separator className="my-4" />

          <div className="grid gap-3">
            {voice.versions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No model versions yet.
              </div>
            ) : (
              voice.versions.map((v) => (
                <div key={v.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Version {v.id.slice(0, 8)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Created: {new Date(v.createdAt).toLocaleString()}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      asChild
                    >
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
      </div>
    </main>
  );
}
