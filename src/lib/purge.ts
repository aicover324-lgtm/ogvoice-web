import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/storage/s3";

export type PurgeResult = {
  checkedVoices: number;
  purgedVoices: number;
  deletedDbAssets: number;
  deletedStorageObjects: number;
};

export async function purgeDeletedVoices(args: {
  retentionDays: number;
  limit?: number;
}) {
  const retentionMs = args.retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - retentionMs);
  const limit = args.limit ?? 20;

  const candidates = await prisma.voiceProfile.findMany({
    where: {
      deletedAt: { not: null, lt: cutoff },
    },
    orderBy: { deletedAt: "asc" },
    take: limit,
    select: { id: true, userId: true },
  });

  const result: PurgeResult = {
    checkedVoices: candidates.length,
    purgedVoices: 0,
    deletedDbAssets: 0,
    deletedStorageObjects: 0,
  };

  for (const v of candidates) {
    // Delete storage objects for assets that belong to this voice.
    const assets = await prisma.uploadAsset.findMany({
      where: { voiceProfileId: v.id, userId: v.userId },
      select: { id: true, storageKey: true },
    });

    const keys = assets.map((a) => a.storageKey).filter(Boolean);
    try {
      const del = await deleteObjects(keys);
      result.deletedStorageObjects += del.deleted;
    } catch {
      // If object deletion fails, we skip DB hard-delete to avoid orphaned pointers.
      // This can be retried later.
      continue;
    }

    // Delete DB rows. We do this after storage deletion.
    const tx = await prisma.$transaction(async (db) => {
      const delAssets = await db.uploadAsset.deleteMany({ where: { voiceProfileId: v.id, userId: v.userId } });
      await db.voiceModelVersion.deleteMany({ where: { voiceProfileId: v.id } });
      await db.trainingJob.deleteMany({ where: { voiceProfileId: v.id, userId: v.userId } });
      await db.generationJob.deleteMany({ where: { voiceProfileId: v.id, userId: v.userId } });
      await db.voiceProfile.delete({ where: { id: v.id } });
      await db.auditLog.create({
        data: {
          userId: v.userId,
          action: "voice.purge",
          meta: { voiceProfileId: v.id, assets: delAssets.count },
        },
      });
      return { deletedAssets: delAssets.count };
    });

    result.deletedDbAssets += tx.deletedAssets;
    result.purgedVoices += 1;
  }

  return result;
}

export async function purgeVoiceNow(args: { userId: string; voiceProfileId: string }) {
  const voice = await prisma.voiceProfile.findFirst({
    where: { id: args.voiceProfileId, userId: args.userId },
    select: { id: true, userId: true },
  });
  if (!voice) return { ok: false as const, reason: "NOT_FOUND" as const };

  const assets = await prisma.uploadAsset.findMany({
    where: { voiceProfileId: voice.id, userId: voice.userId },
    select: { storageKey: true },
  });
  const keys = assets.map((a) => a.storageKey).filter(Boolean);

  try {
    const del = await deleteObjects(keys);
    const tx = await prisma.$transaction(async (db) => {
      const delAssets = await db.uploadAsset.deleteMany({ where: { voiceProfileId: voice.id, userId: voice.userId } });
      await db.voiceModelVersion.deleteMany({ where: { voiceProfileId: voice.id } });
      await db.trainingJob.deleteMany({ where: { voiceProfileId: voice.id, userId: voice.userId } });
      await db.generationJob.deleteMany({ where: { voiceProfileId: voice.id, userId: voice.userId } });
      await db.voiceProfile.delete({ where: { id: voice.id } });
      await db.auditLog.create({
        data: {
          userId: voice.userId,
          action: "voice.purge_now",
          meta: { voiceProfileId: voice.id, deletedAssets: delAssets.count, deletedObjects: del.deleted },
        },
      });
      return { deletedDbAssets: delAssets.count, deletedStorageObjects: del.deleted };
    });
    return { ok: true as const, ...tx };
  } catch {
    return { ok: false as const, reason: "PURGE_FAILED" as const };
  }
}
