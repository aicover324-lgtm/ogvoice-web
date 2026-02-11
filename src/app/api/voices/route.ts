import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { copyObject, deleteObjects } from "@/lib/storage/s3";
import { canonicalVoiceAssetBaseName, voiceDatasetWavKey } from "@/lib/storage/keys";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const voices = await prisma.voiceProfile.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assets: true, versions: true } },
    },
  });

  return ok({ voices });
}

const createSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  language: z.string().max(32).optional(),
  datasetAssetId: z.string().min(1).optional(),
  coverAssetId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid voice profile payload", 400, parsed.error.flatten());

  let voice: { id: string };
  let draftDatasetKeyToDelete: string | null = null;
  let copiedDatasetKeyToRollback: string | null = null;
  try {
    voice = await prisma.$transaction(async (db) => {
      const created = await db.voiceProfile.create({
        data: {
          userId: session.user.id,
          name: parsed.data.name,
          description: parsed.data.description,
          language: parsed.data.language,
        },
      });

      let coverId: string | null = null;
      if (parsed.data.coverAssetId) {
        const cover = await db.uploadAsset.findFirst({
          where: {
            id: parsed.data.coverAssetId,
            userId: session.user.id,
            type: "voice_cover_image",
            voiceProfileId: null,
          },
          select: { id: true },
        });
        if (!cover) {
          throw new Error("COVER_ASSET_INVALID");
        }
        coverId = cover.id;
      }

      if (parsed.data.datasetAssetId) {
        const asset = await db.uploadAsset.findFirst({
          where: {
            id: parsed.data.datasetAssetId,
            userId: session.user.id,
            type: "dataset_audio",
            voiceProfileId: null,
          },
          select: { id: true, storageKey: true },
        });
        if (!asset) {
          throw new Error("DATASET_ASSET_INVALID");
        }

        const datasetStorageKey = voiceDatasetWavKey({
          userId: session.user.id,
          voiceProfileId: created.id,
          voiceName: parsed.data.name,
        });
        const datasetFileName = `${canonicalVoiceAssetBaseName(parsed.data.name)}.wav`;

        if (asset.storageKey !== datasetStorageKey) {
          await copyObject({ fromKey: asset.storageKey, toKey: datasetStorageKey });
          copiedDatasetKeyToRollback = datasetStorageKey;
          draftDatasetKeyToDelete = asset.storageKey;
        }

        await db.uploadAsset.update({
          where: { id: asset.id },
          data: {
            voiceProfileId: created.id,
            storageKey: datasetStorageKey,
            fileName: datasetFileName,
          },
        });
      } else {
        // Require dataset for MVP create flow.
        throw new Error("DATASET_ASSET_INVALID");
      }

      if (coverId) {
        await db.uploadAsset.update({
          where: { id: coverId },
          data: { voiceProfileId: created.id },
        });
      }
      return created;
    });
    copiedDatasetKeyToRollback = null;
  } catch (e) {
    if (copiedDatasetKeyToRollback) {
      try {
        await deleteObjects([copiedDatasetKeyToRollback]);
      } catch {
        // Ignore rollback cleanup errors.
      }
    }
    if (e instanceof Error && e.message === "DATASET_ASSET_INVALID") {
      return err("DATASET_REQUIRED", "Upload a dataset file before creating this voice.", 409);
    }
    if (e instanceof Error && e.message === "COVER_ASSET_INVALID") {
      return err("COVER_INVALID", "Cover image could not be attached. Try uploading it again.", 409);
    }
    return err("INTERNAL", "Could not create voice.", 500);
  }

  if (draftDatasetKeyToDelete) {
    try {
      await deleteObjects([draftDatasetKeyToDelete]);
    } catch {
      // Ignore cleanup errors. The old draft object is harmless.
    }
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "voice.create", meta: { voiceProfileId: voice.id } },
  });

  return ok({ voice });
}

export const runtime = "nodejs";
