import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { env } from "@/lib/env";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { getUserPlan } from "@/lib/plans";
import { presignPutObject, sanitizeFileName } from "@/lib/storage/s3";

const allowedMime = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/x-flac",
]);

const datasetAllowedMime = new Set(["audio/wav", "audio/x-wav"]);

const schema = z.object({
  voiceProfileId: z.string().min(1).optional(),
  type: z.enum(["dataset_audio", "song_input"]),
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
  if (!allowedMime.has(mimeType)) return err("UNSUPPORTED_TYPE", "Only wav/mp3/flac audio is allowed", 415);

  if (type === "dataset_audio") {
    const lower = fileName.toLowerCase();
    if (!datasetAllowedMime.has(mimeType) || !lower.endsWith(".wav")) {
      return err("UNSUPPORTED_TYPE", "Dataset must be a .wav file", 415);
    }
  }

  const plan = await getUserPlan(session.user.id);
  const maxFile = plan === "pro" ? env.UPLOAD_MAX_FILE_BYTES_PRO : env.UPLOAD_MAX_FILE_BYTES_FREE;
  if (fileSize > maxFile) {
    return err("FILE_TOO_LARGE", "File exceeds plan limit", 413, { maxBytes: maxFile, plan });
  }

  const resolvedVoiceId: string | null = voiceProfileId ?? null;
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
    if (!resolvedVoiceId) {
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
  }

  const safeName = sanitizeFileName(fileName);
  const uuid = crypto.randomUUID();
  const keyParts = [
    `u/${session.user.id}`,
    resolvedVoiceId ? `voices/${resolvedVoiceId}` : type === "dataset_audio" ? "drafts" : "misc",
    type === "dataset_audio" ? "dataset" : "inputs",
    `${uuid}_${safeName}`,
  ];
  const storageKey = keyParts.join("/");

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
