import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { assertSafeStorageKey, assertStorageKeyOwnedByUser } from "@/lib/storage/validate";

const schema = z.object({
  voiceProfileId: z.string().min(1).optional(),
  type: z.enum(["dataset_audio", "song_input", "generated_output"]),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(80),
  storageKey: z.string().min(1).max(1024),
});

const datasetAllowedMime = new Set(["audio/wav", "audio/x-wav"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid upload confirm payload", 400, parsed.error.flatten());

  const { voiceProfileId, type, fileName, fileSize, mimeType, storageKey } = parsed.data;

  if (type === "dataset_audio") {
    const lower = fileName.toLowerCase();
    if (!datasetAllowedMime.has(mimeType) || !lower.endsWith(".wav")) {
      return err("UNSUPPORTED_TYPE", "Dataset must be a .wav file", 415);
    }
  }
  try {
    assertSafeStorageKey(storageKey);
    assertStorageKeyOwnedByUser({ storageKey, userId: session.user.id });
  } catch (e) {
    return err(
      "INVALID_STORAGE_KEY",
      e instanceof Error ? e.message : "Invalid storageKey",
      403
    );
  }

  let resolvedVoiceId: string | undefined = voiceProfileId;
  if (resolvedVoiceId) {
    const voice = await prisma.voiceProfile.findFirst({
      where: { id: resolvedVoiceId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);
  }

  if (type === "dataset_audio" && !resolvedVoiceId) {
    // Draft dataset confirm: enforced via DB unique index (prevents race conditions)
    resolvedVoiceId = undefined;
  }

  let asset: { id: string };
  try {
    asset = await prisma.uploadAsset.create({
      data: {
        userId: session.user.id,
        voiceProfileId: resolvedVoiceId,
        type,
        fileName,
        fileSize,
        mimeType,
        storageKey,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && type === "dataset_audio") {
      return err(
        "DATASET_DRAFT_EXISTS",
        "You already uploaded a dataset file for a new voice. Replace it to upload a new one.",
        409
      );
    }
    return err("INTERNAL", "Could not confirm upload.", 500);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "upload.confirm",
      meta: { uploadAssetId: asset.id, voiceProfileId: resolvedVoiceId, type },
    },
  });

  return ok({ asset });
}

export const runtime = "nodejs";
