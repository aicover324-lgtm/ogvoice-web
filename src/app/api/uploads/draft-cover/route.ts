import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { deleteObjects } from "@/lib/storage/s3";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const asset = await prisma.uploadAsset.findFirst({
    where: { userId: session.user.id, voiceProfileId: null, type: "voice_cover_image" },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, fileSize: true, createdAt: true },
  });

  return ok({ asset });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const assets = await prisma.uploadAsset.findMany({
    where: { userId: session.user.id, voiceProfileId: null, type: "voice_cover_image" },
    select: { id: true, storageKey: true },
  });

  if (assets.length === 0) return ok({ deleted: true, deletedDbAssets: 0, deletedStorageObjects: 0 });

  const keys = assets.map((a) => a.storageKey);
  try {
    const del = await deleteObjects(keys);
    const deletedDb = await prisma.uploadAsset.deleteMany({
      where: { userId: session.user.id, voiceProfileId: null, type: "voice_cover_image" },
    });
    return ok({ deleted: true, deletedDbAssets: deletedDb.count, deletedStorageObjects: del.deleted });
  } catch {
    return err("STORAGE_DELETE_FAILED", "Could not delete draft cover images", 502);
  }
}

export const runtime = "nodejs";
