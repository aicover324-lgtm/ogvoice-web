import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const voices = await prisma.voiceProfile.findMany({
    where: { userId: session.user.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: {
      _count: { select: { assets: true } },
      assets: { where: { type: "dataset_audio" }, select: { fileSize: true } },
    },
  });

  const shaped = voices.map((v) => ({
    id: v.id,
    name: v.name,
    language: v.language,
    deletedAt: v.deletedAt,
    datasetFiles: v._count.assets,
    datasetBytes: v.assets.reduce((acc, a) => acc + a.fileSize, 0),
  }));

  return ok({ voices: shaped });
}

export const runtime = "nodejs";
