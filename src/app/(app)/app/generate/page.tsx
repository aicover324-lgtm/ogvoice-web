import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GenerateForm } from "@/components/app/generate-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function GeneratePage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const voices = await prisma.voiceProfile.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, language: true },
  });

  return (
    <main className="og-app-main">
      <PageHeader title="Generate Song" description="End-to-end flow with placeholder outputs." />

      <div className="mt-8">
        {voices.length === 0 ? (
          <div className="rounded-xl border p-6 text-sm text-muted-foreground">
            Create a voice profile first.
          </div>
        ) : (
          <GenerateForm voices={voices} />
        )}
      </div>
    </main>
  );
}
