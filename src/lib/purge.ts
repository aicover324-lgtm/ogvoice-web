import { prisma } from "@/lib/prisma";
import { deleteObjects, listObjectKeysByPrefix } from "@/lib/storage/s3";
import { UploadAssetType } from "@prisma/client";

const STALE_DRAFT_TYPES: UploadAssetType[] = ["dataset_audio", "voice_cover_image"];

export type PurgeResult = {
  checkedVoices: number;
  purgedVoices: number;
  deletedDbAssets: number;
  deletedStorageObjects: number;
};

export type DraftCleanupResult = {
  checkedDraftAssets: number;
  deletedDraftAssets: number;
  deletedDraftStorageObjects: number;
};

export type GeneratedOutputCleanupResult = {
  checkedGeneratedAssets: number;
  deletedGeneratedAssets: number;
  deletedGeneratedStorageObjects: number;
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

function staleDraftWhere(args: { cutoff: Date; userId?: string }) {
  return {
    ...(args.userId ? { userId: args.userId } : {}),
    voiceProfileId: null,
    createdAt: { lt: args.cutoff },
    type: { in: STALE_DRAFT_TYPES },
  };
}

async function cleanupDraftAssetsInternal(args: {
  cutoff: Date;
  limit: number;
  userId?: string;
  auditAction?: string;
}) {
  const stale = await prisma.uploadAsset.findMany({
    where: staleDraftWhere({ cutoff: args.cutoff, userId: args.userId }),
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(1000, args.limit)),
    select: { id: true, storageKey: true },
  });

  if (stale.length === 0) {
    return {
      checkedDraftAssets: 0,
      deletedDraftAssets: 0,
      deletedDraftStorageObjects: 0,
    } satisfies DraftCleanupResult;
  }

  const keys = Array.from(new Set(stale.map((x) => normalizeStorageKey(x.storageKey)).filter((v): v is string => !!v)));
  const ids = stale.map((x) => x.id);

  let deletedStorageObjects = 0;
  try {
    const res = await deleteObjects(keys);
    deletedStorageObjects = res.deleted;
  } catch {
    // Keep DB rows if storage deletion failed; try again next run.
    return {
      checkedDraftAssets: stale.length,
      deletedDraftAssets: 0,
      deletedDraftStorageObjects: 0,
    } satisfies DraftCleanupResult;
  }

  const deletedDb = await prisma.uploadAsset.deleteMany({
    where: { id: { in: ids } },
  });

  if (args.userId && args.auditAction) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: args.userId,
          action: args.auditAction,
          meta: {
            checkedDraftAssets: stale.length,
            deletedDraftAssets: deletedDb.count,
            deletedDraftStorageObjects: deletedStorageObjects,
          },
        },
      });
    } catch {
      // Ignore audit failures.
    }
  }

  return {
    checkedDraftAssets: stale.length,
    deletedDraftAssets: deletedDb.count,
    deletedDraftStorageObjects: deletedStorageObjects,
  } satisfies DraftCleanupResult;
}

export async function cleanupStaleDraftAssets(args: { retentionHours: number; limit?: number }) {
  const retentionMs = Math.max(1, args.retentionHours) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - retentionMs);
  return cleanupDraftAssetsInternal({
    cutoff,
    limit: args.limit ?? 200,
  });
}

export async function cleanupStaleDraftAssetsForUser(args: { userId: string; retentionHours: number }) {
  const retentionMs = Math.max(1, args.retentionHours) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - retentionMs);
  return cleanupDraftAssetsInternal({
    cutoff,
    limit: 40,
    userId: args.userId,
    auditAction: "storage.draft_cleanup.user",
  });
}

export async function cleanupStaleGeneratedOutputs(args: { retentionDays: number; limit?: number }) {
  const retentionMs = Math.max(1, args.retentionDays) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - retentionMs);
  const stale = await prisma.uploadAsset.findMany({
    where: {
      type: "generated_output",
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(2000, args.limit ?? 400)),
    select: { id: true, userId: true, storageKey: true },
  });

  if (stale.length === 0) {
    return {
      checkedGeneratedAssets: 0,
      deletedGeneratedAssets: 0,
      deletedGeneratedStorageObjects: 0,
    } satisfies GeneratedOutputCleanupResult;
  }

  const ids = stale.map((x) => x.id);
  const keys = Array.from(new Set(stale.map((x) => normalizeStorageKey(x.storageKey)).filter((v): v is string => !!v)));

  let deletedStorageObjects = 0;
  try {
    const res = await deleteObjects(keys);
    deletedStorageObjects = res.deleted;
  } catch {
    return {
      checkedGeneratedAssets: stale.length,
      deletedGeneratedAssets: 0,
      deletedGeneratedStorageObjects: 0,
    } satisfies GeneratedOutputCleanupResult;
  }

  const deleted = await prisma.$transaction(async (db) => {
    await db.generationJob.updateMany({
      where: { outputAssetId: { in: ids } },
      data: { outputAssetId: null, outputKey: null },
    });

    const delAssets = await db.uploadAsset.deleteMany({ where: { id: { in: ids } } });

    await db.auditLog.create({
      data: {
        action: "storage.generated_cleanup",
        meta: {
          checkedGeneratedAssets: stale.length,
          deletedGeneratedAssets: delAssets.count,
          deletedGeneratedStorageObjects: deletedStorageObjects,
          retentionDays: Math.max(1, args.retentionDays),
        },
      },
    });

    return delAssets.count;
  });

  return {
    checkedGeneratedAssets: stale.length,
    deletedGeneratedAssets: deleted,
    deletedGeneratedStorageObjects: deletedStorageObjects,
  } satisfies GeneratedOutputCleanupResult;
}
