import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MyLibraryPanel } from "@/components/app/my-library-panel";
import { PageHeader } from "@/components/ui/page-header";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ playAssetId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const params = await searchParams;

  const jobs = await prisma.generationJob.findMany({
    where: { userId, outputAssetId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      outputAssetId: true,
      createdAt: true,
      voiceProfile: { select: { id: true, name: true } },
    },
  });

  const assetIds = jobs.map((j) => j.outputAssetId).filter((id): id is string => !!id);
  const assets = assetIds.length
    ? await prisma.uploadAsset.findMany({
        where: { userId, id: { in: assetIds }, type: "generated_output" },
        select: { id: true, fileName: true },
      })
    : [];
  const assetById = new Map(assets.map((a) => [a.id, a.fileName]));

  const initialItems = jobs
    .map((j) => {
      const assetId = j.outputAssetId;
      if (!assetId) return null;
      if (!assetById.has(assetId)) return null;
      return {
        jobId: j.id,
        assetId,
        fileName: assetById.get(assetId) || "converted.wav",
        voiceId: j.voiceProfile.id,
        voiceName: j.voiceProfile.name,
        createdAt: j.createdAt.toISOString(),
      };
    })
    .filter((x): x is { jobId: string; assetId: string; fileName: string; voiceId: string; voiceName: string; createdAt: string } => !!x);

  return (
    <main className="og-app-main">
      <PageHeader title="My Library" />
      <div className="mt-5 md:mt-6">
        <MyLibraryPanel initialItems={initialItems} initialAutoPlayAssetId={typeof params.playAssetId === "string" ? params.playAssetId : null} />
      </div>
    </main>
  );
}
