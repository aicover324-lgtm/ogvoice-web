import { getServerSession } from "next-auth";
import Link from "next/link";
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
          progress: true,
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
          progress: v.trainingJobs[0].progress,
          artifactKey: v.trainingJobs[0].artifactKey,
          errorMessage: v.trainingJobs[0].errorMessage,
        }
      : null,
  }));

  return (
    <main className="og-app-main">
      <PageHeader title="Clone Voice" />

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#0f1831] p-4 md:p-5">
        <p className="text-sm text-slate-200">
          Create and manage your cloned voices here. Upload a singing record, start cloning, and use ready voices in{" "}
          <Link href="/app/generate" className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline">
            Generate
          </Link>
          .
        </p>
      </section>

      {cards.length === 0 ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          No voices yet. Create one from the Create Voice tab.
        </div>
      ) : (
        <CloneVoiceSections voices={cards} />
      )}
    </main>
  );
}
