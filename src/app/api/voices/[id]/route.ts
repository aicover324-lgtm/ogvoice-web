import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { copyObject, deleteObjects } from "@/lib/storage/s3";
import { canonicalVoiceAssetBaseName } from "@/lib/storage/keys";

type Ctx = { params: Promise<{ id: string }> };

const ACTIVE_JOB_STATUSES: Array<"queued" | "running"> = ["queued", "running"];

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(500).nullable().optional(),
  language: z.string().max(32).nullable().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const voice = await prisma.voiceProfile.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    include: {
      assets: { where: { type: "dataset_audio" }, orderBy: { createdAt: "desc" } },
      versions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);
  return ok({ voice });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid update payload", 400, parsed.error.flatten());

  const voice = await prisma.voiceProfile.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: { id: true, userId: true, name: true },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  const activeTraining = await prisma.trainingJob.findFirst({
    where: {
      userId: session.user.id,
      voiceProfileId: id,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    select: { id: true },
  });
  if (activeTraining) {
    return err(
      "TRAINING_IN_PROGRESS",
      "Voice actions are locked while training is in progress.",
      409
    );
  }

  const nextName = typeof parsed.data.name === "string" ? parsed.data.name.trim() : undefined;
  const updateData = {
    ...parsed.data,
    ...(nextName ? { name: nextName } : {}),
  };

  const shouldRenameStorage = typeof nextName === "string" && nextName.length > 0 && nextName !== voice.name;
  if (!shouldRenameStorage) {
    const updated = await prisma.voiceProfile.update({ where: { id }, data: updateData });
    return ok({ voice: updated });
  }

  const baseName = canonicalVoiceAssetBaseName(nextName!);

  const [datasetAssetsRaw, coverAssetsRaw, versions, jobs] = await Promise.all([
    prisma.uploadAsset.findMany({
      where: { userId: session.user.id, voiceProfileId: id, type: "dataset_audio" },
      orderBy: { createdAt: "desc" },
      select: { id: true, storageKey: true, fileName: true, mimeType: true, createdAt: true },
    }),
    prisma.uploadAsset.findMany({
      where: { userId: session.user.id, voiceProfileId: id, type: "voice_cover_image" },
      orderBy: { createdAt: "desc" },
      select: { id: true, storageKey: true, fileName: true, mimeType: true, createdAt: true },
    }),
    prisma.voiceModelVersion.findMany({
      where: { voiceProfileId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, modelArtifactKey: true },
    }),
    prisma.trainingJob.findMany({
      where: { userId: session.user.id, voiceProfileId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, datasetKey: true, artifactKey: true },
    }),
  ]);

  const keyPlan = new Map<string, string>();
  const keyToDelete = new Set<string>();
  const copiedKeys: string[] = [];

  const datasetUpdates: Array<{ id: string; storageKey: string; fileName: string }> = [];
  const coverUpdates: Array<{ id: string; storageKey: string; fileName: string }> = [];
  const versionUpdates: Array<{ id: string; modelArtifactKey: string }> = [];
  const jobUpdates: Array<{ id: string; datasetKey?: string; artifactKey?: string }> = [];

  const usedDatasetNames = new Set<string>();
  const usedCoverNames = new Set<string>();

  for (const asset of datasetAssetsRaw) {
    const ext = fileExtension({
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      storageKey: asset.storageKey,
      fallback: "wav",
    });
    const nextFile = uniqueFileName(baseName, ext, usedDatasetNames);
    const nextKey = `datasets/u/${voice.userId}/v/${voice.id}/${nextFile}`;
    datasetUpdates.push({ id: asset.id, storageKey: nextKey, fileName: nextFile });
    addRenamePlan(keyPlan, asset.storageKey, nextKey);
  }

  for (const asset of coverAssetsRaw) {
    const ext = fileExtension({
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      storageKey: asset.storageKey,
      fallback: "webp",
    });
    const nextFile = uniqueFileName(baseName, ext, usedCoverNames);
    const nextKey = `u/${voice.userId}/voices/${voice.id}/covers/${nextFile}`;
    coverUpdates.push({ id: asset.id, storageKey: nextKey, fileName: nextFile });
    addRenamePlan(keyPlan, asset.storageKey, nextKey);
  }

  for (const version of versions) {
    const nextKey = replaceKeyBasename(version.modelArtifactKey, `${baseName}.zip`);
    versionUpdates.push({ id: version.id, modelArtifactKey: nextKey });
    addRenamePlan(keyPlan, version.modelArtifactKey, nextKey);
  }

  for (const job of jobs) {
    const patch: { id: string; datasetKey?: string; artifactKey?: string } = { id: job.id };
    if (job.datasetKey && keyPlan.has(job.datasetKey)) {
      patch.datasetKey = keyPlan.get(job.datasetKey);
    }
    if (job.artifactKey && keyPlan.has(job.artifactKey)) {
      patch.artifactKey = keyPlan.get(job.artifactKey);
    }
    if (patch.datasetKey || patch.artifactKey) jobUpdates.push(patch);
  }

  try {
    for (const [fromKey, toKey] of keyPlan.entries()) {
      await copyObject({ fromKey, toKey });
      copiedKeys.push(toKey);
      keyToDelete.add(fromKey);
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const row of datasetUpdates) {
        await tx.uploadAsset.update({
          where: { id: row.id },
          data: { storageKey: row.storageKey, fileName: row.fileName },
        });
      }
      for (const row of coverUpdates) {
        await tx.uploadAsset.update({
          where: { id: row.id },
          data: { storageKey: row.storageKey, fileName: row.fileName },
        });
      }
      for (const row of versionUpdates) {
        await tx.voiceModelVersion.update({
          where: { id: row.id },
          data: { modelArtifactKey: row.modelArtifactKey },
        });
      }
      for (const row of jobUpdates) {
        const data: { datasetKey?: string; artifactKey?: string } = {};
        if (row.datasetKey) data.datasetKey = row.datasetKey;
        if (row.artifactKey) data.artifactKey = row.artifactKey;
        if (Object.keys(data).length > 0) {
          await tx.trainingJob.update({ where: { id: row.id }, data });
        }
      }

      return tx.voiceProfile.update({
        where: { id },
        data: updateData,
      });
    });

    if (keyToDelete.size > 0) {
      try {
        await deleteObjects(Array.from(keyToDelete));
      } catch {
        // Best-effort cleanup only.
      }
    }

    return ok({ voice: updated });
  } catch (e) {
    if (copiedKeys.length > 0) {
      try {
        await deleteObjects(copiedKeys);
      } catch {
        // Best-effort rollback only.
      }
    }
    return err("VOICE_UPDATE_FAILED", e instanceof Error ? e.message : "Could not update voice", 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const exists = await prisma.voiceProfile.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!exists) return err("NOT_FOUND", "Voice profile not found", 404);

  const activeTraining = await prisma.trainingJob.findFirst({
    where: {
      userId: session.user.id,
      voiceProfileId: id,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    select: { id: true },
  });
  if (activeTraining) {
    return err(
      "TRAINING_IN_PROGRESS",
      "Voice actions are locked while training is in progress.",
      409
    );
  }

  await prisma.voiceProfile.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: session.user.id, action: "voice.soft_delete", meta: { voiceProfileId: id } } });
  return ok({ deleted: true });
}

function addRenamePlan(plan: Map<string, string>, fromKey: string, toKey: string) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const existing = plan.get(fromKey);
  if (existing && existing !== toKey) {
    throw new Error(`Conflicting rename plan for key ${fromKey}`);
  }
  plan.set(fromKey, toKey);
}

function uniqueFileName(baseName: string, extension: string, used: Set<string>) {
  let i = 1;
  let next = `${baseName}.${extension}`;
  while (used.has(next)) {
    i += 1;
    next = `${baseName}-${i}.${extension}`;
  }
  used.add(next);
  return next;
}

function replaceKeyBasename(storageKey: string, fileName: string) {
  const idx = storageKey.lastIndexOf("/");
  if (idx < 0) return fileName;
  return `${storageKey.slice(0, idx + 1)}${fileName}`;
}

function fileExtension(args: {
  fileName?: string | null;
  mimeType?: string | null;
  storageKey?: string | null;
  fallback: string;
}) {
  const byName = extensionFromName(args.fileName || "") || extensionFromName(args.storageKey || "");
  if (byName) return byName;

  const mime = (args.mimeType || "").toLowerCase();
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/flac") return "flac";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/zip") return "zip";

  return args.fallback;
}

function extensionFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  if (lower.endsWith(".flac")) return "flac";
  if (lower.endsWith(".wav")) return "wav";
  if (lower.endsWith(".zip")) return "zip";
  return null;
}

export const runtime = "nodejs";
