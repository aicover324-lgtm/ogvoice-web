import { prisma } from "@/lib/prisma";
import { deleteObjects, listObjectKeysByPrefix } from "@/lib/storage/s3";

export type PurgeResult = {
  checkedVoices: number;
  purgedVoices: number;
  deletedDbAssets: number;
  deletedStorageObjects: number;
};

function voiceStoragePrefixes(args: { userId: string; voiceProfileId: string }) {
  const { userId, voiceProfileId } = args;
  return [
    `datasets/u/${userId}/v/${voiceProfileId}/`,
    `models/u/${userId}/v/${voiceProfileId}/`,
    `u/${userId}/voices/${voiceProfileId}/`,
  ];
}

function normalizeStorageKey(key?: string | null) {
  if (!key) return null;
  if (key.startsWith("external:")) return null;
  return key;
}

async function collectVoiceStorageKeys(args: { userId: string; voiceProfileId: string }) {
  const prefixes = voiceStoragePrefixes(args);

  const [assets, jobs, versions, ...prefixKeyLists] = await Promise.all([
    prisma.uploadAsset.findMany({
      where: { userId: args.userId, voiceProfileId: args.voiceProfileId },
      select: { storageKey: true },
    }),
    prisma.trainingJob.findMany({
      where: { userId: args.userId, voiceProfileId: args.voiceProfileId },
      select: { datasetKey: true, artifactKey: true },
    }),
    prisma.voiceModelVersion.findMany({
      where: { voiceProfileId: args.voiceProfileId },
      select: { modelArtifactKey: true },
    }),
    ...prefixes.map((prefix) => listObjectKeysByPrefix(prefix)),
  ]);

  const keys = new Set<string>();

  for (const a of assets) {
    const k = normalizeStorageKey(a.storageKey);
    if (k) keys.add(k);
  }
  for (const j of jobs) {
    const datasetKey = normalizeStorageKey(j.datasetKey);
    const artifactKey = normalizeStorageKey(j.artifactKey);
    if (datasetKey) keys.add(datasetKey);
    if (artifactKey) keys.add(artifactKey);
  }
  for (const v of versions) {
    const k = normalizeStorageKey(v.modelArtifactKey);
    if (k) keys.add(k);
  }
  for (const list of prefixKeyLists) {
    for (const k of list) {
      const key = normalizeStorageKey(k);
      if (key) keys.add(key);
    }
  }

  return [...keys];
}

async function purgeSingleVoice(args: {
  userId: string;
  voiceProfileId: string;
  action: "voice.purge" | "voice.purge_now";
}) {
  const keys = await collectVoiceStorageKeys({ userId: args.userId, voiceProfileId: args.voiceProfileId });
  const del = await deleteObjects(keys);

  const prefixes = voiceStoragePrefixes({ userId: args.userId, voiceProfileId: args.voiceProfileId });

  const tx = await prisma.$transaction(async (db) => {
    const delAssets = await db.uploadAsset.deleteMany({
      where: {
        userId: args.userId,
        OR: [
          { voiceProfileId: args.voiceProfileId },
          { storageKey: { startsWith: prefixes[0] } },
          { storageKey: { startsWith: prefixes[1] } },
          { storageKey: { startsWith: prefixes[2] } },
        ],
      },
    });

    await db.voiceModelVersion.deleteMany({ where: { voiceProfileId: args.voiceProfileId } });
    await db.trainingJob.deleteMany({ where: { voiceProfileId: args.voiceProfileId, userId: args.userId } });
    await db.generationJob.deleteMany({ where: { voiceProfileId: args.voiceProfileId, userId: args.userId } });
    await db.voiceProfile.delete({ where: { id: args.voiceProfileId } });

    await db.auditLog.create({
      data: {
        userId: args.userId,
        action: args.action,
        meta: {
          voiceProfileId: args.voiceProfileId,
          deletedAssets: delAssets.count,
          deletedObjects: del.deleted,
          deletedObjectKeysChecked: keys.length,
        },
      },
    });

    return { deletedDbAssets: delAssets.count, deletedStorageObjects: del.deleted };
  });

  return tx;
}

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
    try {
      const one = await purgeSingleVoice({
        userId: v.userId,
        voiceProfileId: v.id,
        action: "voice.purge",
      });
      result.deletedStorageObjects += one.deletedStorageObjects;
      result.deletedDbAssets += one.deletedDbAssets;
      result.purgedVoices += 1;
    } catch {
      // Keep going; failed items can be retried by next purge run.
      continue;
    }
  }

  return result;
}

export async function purgeVoiceNow(args: { userId: string; voiceProfileId: string }) {
  const voice = await prisma.voiceProfile.findFirst({
    where: { id: args.voiceProfileId, userId: args.userId },
    select: { id: true, userId: true },
  });
  if (!voice) return { ok: false as const, reason: "NOT_FOUND" as const };

  try {
    const tx = await purgeSingleVoice({
      userId: voice.userId,
      voiceProfileId: voice.id,
      action: "voice.purge_now",
    });
    return { ok: true as const, ...tx };
  } catch {
    return { ok: false as const, reason: "PURGE_FAILED" as const };
  }
}
