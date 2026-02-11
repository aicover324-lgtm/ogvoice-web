import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VoiceCloneCard } from "@/components/app/voice-clone-card";

export default async function VoicesPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const voices = await prisma.voiceProfile.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      assets: { where: { type: "dataset_audio" }, select: { id: true }, take: 1 },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          Clone Voice
        </h1>
      </div>

      <div className="mt-8 grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3">
        {voices.length === 0 ? (
          <div className="text-sm text-muted-foreground">No voices yet. Create one from the Create Voice tab.</div>
        ) : (
          voices.map((v) => (
            <VoiceCloneCard
              key={v.id}
              voice={{
                id: v.id,
                name: v.name,
                language: v.language,
                description: v.description,
                hasDataset: v.assets.length > 0,
              }}
            />
          ))
        )}
      </div>
    </main>
  );
}
