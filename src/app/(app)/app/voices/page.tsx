import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CloneVoiceSections } from "@/components/app/clone-voice-sections";
import { PageHeader } from "@/components/ui/page-header";

export default async function VoicesPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const voices = await prisma.voiceProfile.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      assets: { where: { type: "dataset_audio" }, select: { id: true }, take: 1 },
      trainingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          artifactKey: true,
          errorMessage: true,
        },
      },
    },
  });
  const cards = voices.map((v) => ({
    id: v.id,
    name: v.name,
    language: v.language,
    description: v.description,
    hasDataset: v.assets.length > 0,
    latestTrainingJob: v.trainingJobs[0]
      ? {
          id: v.trainingJobs[0].id,
          status: v.trainingJobs[0].status,
          artifactKey: v.trainingJobs[0].artifactKey,
          errorMessage: v.trainingJobs[0].errorMessage,
        }
      : null,
  }));

  return (
    <main className="og-app-main">
      <PageHeader title="Clone Voice" />

      {cards.length === 0 ? (
        <div className="mt-8 text-sm text-muted-foreground">No voices yet. Create one from the Create Voice tab.</div>
      ) : (
        <CloneVoiceSections voices={cards} />
      )}
    </main>
  );
}
