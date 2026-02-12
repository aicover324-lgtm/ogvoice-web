import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GenerateForm } from "@/components/app/generate-form";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ voiceId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const params = await searchParams;
  const [voices, recentJobsRaw] = await Promise.all([
    prisma.voiceProfile.findMany({
      where: { userId, deletedAt: null, versions: { some: {} } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, language: true },
    }),
    prisma.generationJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        progress: true,
        errorMessage: true,
        inputAssetId: true,
        outputAssetId: true,
        createdAt: true,
        voiceProfile: { select: { name: true } },
      },
    }),
  ]);

  const inputIds = recentJobsRaw.map((j) => j.inputAssetId).filter((id): id is string => !!id);
  const outputIds = recentJobsRaw.map((j) => j.outputAssetId).filter((id): id is string => !!id);
  const assets = inputIds.length + outputIds.length > 0
    ? await prisma.uploadAsset.findMany({
        where: { userId, id: { in: [...inputIds, ...outputIds] } },
        select: { id: true, fileName: true },
      })
    : [];
  const assetById = new Map(assets.map((a) => [a.id, a.fileName]));

  const initialQueue = recentJobsRaw.map((j) => ({
    id: j.id,
    status: j.status,
    progress: j.progress,
    errorMessage: j.errorMessage,
    createdAt: j.createdAt.toISOString(),
    voiceName: j.voiceProfile.name,
    inputLabel: j.inputAssetId ? assetById.get(j.inputAssetId) || "Singing record" : "Singing record",
    outputAssetId: j.outputAssetId,
    outputFileName: j.outputAssetId ? assetById.get(j.outputAssetId) || "converted.wav" : null,
  }));

  const requestedVoiceId = typeof params.voiceId === "string" ? params.voiceId : null;
  const initialVoiceId = requestedVoiceId && voices.some((v) => v.id === requestedVoiceId) ? requestedVoiceId : null;

  return (
    <main className="px-4 pb-8 pt-6 md:px-6 xl:px-8">
        {voices.length === 0 ? (
          <div className="rounded-xl border p-6 text-sm text-muted-foreground">
            Clone a voice first, then come back here to convert your singing record.
          </div>
        ) : (
        <GenerateForm
          voices={voices}
          initialVoiceProfileId={initialVoiceId}
          initialQueue={initialQueue}
        />
        )}
    </main>
  );
}
