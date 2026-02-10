import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { env } from "@/lib/env";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { getUserPlan } from "@/lib/plans";
import { presignPutObject, sanitizeFileName } from "@/lib/storage/s3";

const allowedAudioMime = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/x-flac",
]);

const allowedImageMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const datasetAllowedMime = new Set(["audio/wav", "audio/x-wav"]);

const schema = z.object({
  voiceProfileId: z.string().min(1).optional(),
  type: z.enum(["dataset_audio", "song_input", "avatar_image", "voice_cover_image"]),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);
  const ip = getRequestIp(req);

  const rl = await rateLimit(`presign:${session.user.id}:${ip}`, { windowMs: 60_000, max: 40 });
  if (!rl.allowed) return err("RATE_LIMITED", "Too many requests", 429, { resetAt: rl.resetAt });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid upload presign payload", 400, parsed.error.flatten());

  const { fileName, fileSize, mimeType, voiceProfileId, type } = parsed.data;
  if (type === "dataset_audio" || type === "song_input") {
    if (!allowedAudioMime.has(mimeType)) {
      return err("UNSUPPORTED_TYPE", "Only wav/mp3/flac audio is allowed", 415);
    }
  } else {
    if (!allowedImageMime.has(mimeType)) {
      return err("UNSUPPORTED_TYPE", "Only jpg/png/webp images are allowed", 415);
    }
  }

  if (type === "dataset_audio") {
    const lower = fileName.toLowerCase();
    if (!datasetAllowedMime.has(mimeType) || !lower.endsWith(".wav")) {
      return err("UNSUPPORTED_TYPE", "Dataset must be a .wav file", 415);
    }
  }

  if (type === "avatar_image" && voiceProfileId) {
    return err("INVALID_INPUT", "voiceProfileId is not allowed for avatar", 400);
  }
  if (type === "voice_cover_image" && !voiceProfileId) {
    return err("INVALID_INPUT", "voiceProfileId is required for cover image", 400);
  }

  const plan = await getUserPlan(session.user.id);
  // Per-type size checks
  if (type === "avatar_image" || type === "voice_cover_image") {
    const maxBytes = env.UPLOAD_MAX_IMAGE_BYTES;
    if (fileSize > maxBytes) {
      return err("FILE_TOO_LARGE", "Image exceeds limit", 413, { maxBytes, plan, type });
    }
  }
  if (type === "song_input") {
    const maxBytes = plan === "pro" ? env.UPLOAD_MAX_FILE_BYTES_PRO : env.UPLOAD_MAX_FILE_BYTES_FREE;
    if (fileSize > maxBytes) {
      return err("FILE_TOO_LARGE", "File exceeds plan limit", 413, { maxBytes, plan, type });
    }
  }

  if (type === "dataset_audio" && voiceProfileId) {
    return err(
      "DATASET_LOCKED",
      "Dataset replacement is only available while creating a new voice.",
      403
    );
  }

  const resolvedVoiceId: string | null =
    type === "song_input" || type === "voice_cover_image" ? (voiceProfileId ?? null) : null;
  if (resolvedVoiceId) {
    const voice = await prisma.voiceProfile.findFirst({
      where: { id: resolvedVoiceId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);
  }

  if (type === "dataset_audio") {
    // Plan quota check for dataset
    const datasetMax = plan === "pro" ? env.UPLOAD_MAX_DATASET_BYTES_PRO : env.UPLOAD_MAX_DATASET_BYTES_FREE;
    if (fileSize > datasetMax) {
      return err("QUOTA_EXCEEDED", "Dataset quota exceeded", 403, {
        plan,
        maxBytes: datasetMax,
        attemptedBytes: fileSize,
      });
    }

    // Draft dataset upload (used on the create-voice screen). One draft per user.
    const draftCount = await prisma.uploadAsset.count({
      where: { userId: session.user.id, voiceProfileId: null, type: "dataset_audio" },
    });
    if (draftCount >= 1) {
      return err(
        "DATASET_DRAFT_EXISTS",
        "You already uploaded a dataset file for a new voice. Replace it to upload a new one.",
        409
      );
    }
  }

  const safeName = sanitizeFileName(fileName);
  const uuid = crypto.randomUUID();

  const storageKey = (() => {
    const userPrefix = `u/${session.user.id}`;
    if (type === "avatar_image") {
      return `${userPrefix}/tmp/avatars/${uuid}_${safeName}`;
    }
    if (type === "voice_cover_image") {
      return `${userPrefix}/voices/${resolvedVoiceId}/tmp/covers/${uuid}_${safeName}`;
    }
    if (type === "dataset_audio") {
      return `${userPrefix}/drafts/dataset/${uuid}_${safeName}`;
    }
    // song_input
    return resolvedVoiceId
      ? `${userPrefix}/voices/${resolvedVoiceId}/inputs/${uuid}_${safeName}`
      : `${userPrefix}/misc/inputs/${uuid}_${safeName}`;
  })();

  const uploadUrl = await presignPutObject({
    key: storageKey,
    contentType: mimeType,
  });

  return ok({
    uploadUrl,
    storageKey,
    requiredHeaders: {
      "Content-Type": mimeType,
    },
  });
}

export const runtime = "nodejs";
