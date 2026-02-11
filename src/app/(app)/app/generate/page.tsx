import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GenerateForm } from "@/components/app/generate-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ voiceId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const params = await searchParams;
  const voices = await prisma.voiceProfile.findMany({
    where: { userId, deletedAt: null, versions: { some: {} } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, language: true },
  });

  const requestedVoiceId = typeof params.voiceId === "string" ? params.voiceId : null;
  const initialVoiceId = requestedVoiceId && voices.some((v) => v.id === requestedVoiceId) ? requestedVoiceId : null;

  return (
    <main className="og-app-main">
      <PageHeader
        title="Generate"
        description="Use your cloned voices to convert clean singing records."
      />

      <div className="mt-8">
        {voices.length === 0 ? (
          <div className="rounded-xl border p-6 text-sm text-muted-foreground">
            Clone a voice first, then come back here to convert your singing record.
          </div>
        ) : (
          <GenerateForm voices={voices} initialVoiceProfileId={initialVoiceId} />
        )}
      </div>
    </main>
  );
}
