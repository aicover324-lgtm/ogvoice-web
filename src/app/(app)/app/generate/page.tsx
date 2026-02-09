import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GenerateForm } from "@/components/app/generate-form";

export default async function GeneratePage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const voices = await prisma.voiceProfile.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, language: true },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          Generate Song
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">End-to-end flow with placeholder outputs.</p>
      </div>

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
