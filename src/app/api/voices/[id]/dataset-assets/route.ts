import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { deleteObjects } from "@/lib/storage/s3";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id: voiceProfileId } = await ctx.params;
  const voice = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  const assets = await prisma.uploadAsset.findMany({
    where: { userId: session.user.id, voiceProfileId, type: "dataset_audio" },
    select: { id: true, storageKey: true },
    orderBy: { createdAt: "desc" },
  });
  const keys = assets.map((a) => a.storageKey);
  if (keys.length > 0) await deleteObjects(keys);
  if (assets.length > 0) {
    await prisma.uploadAsset.deleteMany({
      where: { id: { in: assets.map((a) => a.id) } },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "dataset.clear",
      meta: { voiceProfileId, deletedCount: assets.length },
    },
  });

  return ok({ deleted: assets.length });
}

export const runtime = "nodejs";
