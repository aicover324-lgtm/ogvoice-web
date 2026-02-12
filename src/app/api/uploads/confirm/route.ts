import { z } from "zod";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { assertSafeStorageKey, assertStorageKeyOwnedByUser } from "@/lib/storage/validate";
import { deleteObjects, getObjectBytes, putObjectBytes } from "@/lib/storage/s3";
import { canonicalImageExtension, canonicalVoiceAssetBaseName, voiceCoverImageKey } from "@/lib/storage/keys";
import sharp from "sharp";

const schema = z.object({
  voiceProfileId: z.string().min(1).optional(),
  type: z.enum(["dataset_audio", "song_input", "generated_output", "avatar_image", "voice_cover_image"]),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(80),
  storageKey: z.string().min(1).max(1024),
});

const datasetAllowedMime = new Set(["audio/wav", "audio/x-wav"]);
const imageAllowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const TARGET_DATASET_SAMPLE_RATE = 32000;
const TARGET_DATASET_CHANNELS = 1;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid upload confirm payload", 400, parsed.error.flatten());

  const { voiceProfileId, type, fileName, fileSize, mimeType, storageKey } = parsed.data;
  let effectiveFileSize = fileSize;
  let effectiveMimeType = mimeType;

  if (type === "dataset_audio" && voiceProfileId) {
    return err(
      "DATASET_LOCKED",
      "Dataset replacement is only available while creating a new voice.",
      403
    );
  }

  if (type === "avatar_image" && voiceProfileId) {
    return err("INVALID_INPUT", "voiceProfileId is not allowed for avatar", 400);
  }

  if (type === "dataset_audio") {
    const lower = fileName.toLowerCase();
    if (!datasetAllowedMime.has(mimeType) || !lower.endsWith(".wav")) {
      return err("UNSUPPORTED_TYPE", "Dataset must be a .wav file", 415);
    }
  }

  if (type === "avatar_image" || type === "voice_cover_image") {
    if (!imageAllowedMime.has(mimeType)) {
      return err("UNSUPPORTED_TYPE", "Only jpg/png/webp images are allowed", 415);
    }
    if (fileSize > env.UPLOAD_MAX_IMAGE_BYTES) {
      return err("FILE_TOO_LARGE", "Image exceeds limit", 413, { maxBytes: env.UPLOAD_MAX_IMAGE_BYTES });
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
  let resolvedVoiceName: string | null = null;
  if (resolvedVoiceId) {
    const voice = await prisma.voiceProfile.findFirst({
      where: { id: resolvedVoiceId, userId: session.user.id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);
    resolvedVoiceName = voice.name;

    if (type === "voice_cover_image") {
      const activeTraining = await prisma.trainingJob.findFirst({
        where: {
          userId: session.user.id,
          voiceProfileId: resolvedVoiceId,
          status: { in: ["queued", "running"] },
        },
        select: { id: true },
      });
      if (activeTraining) {
        return err(
          "TRAINING_IN_PROGRESS",
          "Cover replacement is locked while voice training is in progress.",
          409
        );
      }
    }
  }

  if (type === "dataset_audio") {
    // Draft dataset confirm: enforced via DB unique index (prevents race conditions)
    resolvedVoiceId = undefined;
  }

  // Extra guardrails: ensure the upload key matches the expected prefix for this type.
  const userPrefix = `u/${session.user.id}`;
  if (type === "avatar_image") {
    const expected = `${userPrefix}/tmp/avatars/`;
    if (!storageKey.startsWith(expected)) {
      return err("INVALID_STORAGE_KEY", "Invalid avatar upload key", 403);
    }
  }
  if (type === "voice_cover_image") {
    const expected = resolvedVoiceId
      ? `${userPrefix}/voices/${resolvedVoiceId}/tmp/covers/`
      : `${userPrefix}/drafts/tmp/covers/`;
    if (!storageKey.startsWith(expected)) {
      return err("INVALID_STORAGE_KEY", "Invalid cover upload key", 403);
    }
  }
  if (type === "dataset_audio") {
    const expected = `${userPrefix}/drafts/dataset/`;
    if (!storageKey.startsWith(expected)) {
      return err("INVALID_STORAGE_KEY", "Invalid dataset upload key", 403);
    }
  }

  // Audio optimization pipeline for dataset uploads.
  // Target format for RVC: 32000 Hz, mono, 16-bit PCM WAV.
  if (type === "dataset_audio") {
    try {
      const uploaded = await getObjectBytes({ key: storageKey, maxBytes: fileSize + 1024 * 1024 });
      const optimized = await optimizeDatasetWav(uploaded);
      await putObjectBytes({
        key: storageKey,
        bytes: optimized,
        contentType: "audio/wav",
        cacheControl: "private, no-cache",
      });
      effectiveFileSize = optimized.length;
      effectiveMimeType = "audio/wav";

      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "dataset.optimized",
            meta: {
              storageKey,
              inputBytes: uploaded.length,
              outputBytes: optimized.length,
              sampleRate: TARGET_DATASET_SAMPLE_RATE,
              channels: TARGET_DATASET_CHANNELS,
              bitDepth: 16,
            },
          },
        });
      } catch {
        // Ignore audit failures.
      }
    } catch (e) {
      return err(
        "DATASET_OPTIMIZE_FAILED",
        e instanceof Error
          ? `Could not optimize your recording: ${e.message}`
          : "Could not optimize your recording. Please re-upload and try again.",
        500
      );
    }
  }

  // Image optimization pipeline: store optimized image and delete original upload.
  if (type === "avatar_image" || type === "voice_cover_image") {
    try {
      const input = await getObjectBytes({ key: storageKey, maxBytes: env.UPLOAD_MAX_IMAGE_BYTES });

      const isAvatar = type === "avatar_image";
      const size = isAvatar ? 256 : 768;
      const ext = isAvatar ? "webp" : canonicalImageExtension({ fileName, mimeType });
      const optimizedBase = sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize(size, size, { fit: "cover" });
      const optimized =
        ext === "jpg"
          ? await optimizedBase.jpeg({ quality: 86, mozjpeg: true }).toBuffer()
          : ext === "png"
            ? await optimizedBase.png({ compressionLevel: 9 }).toBuffer()
            : await optimizedBase.webp({ quality: 82 }).toBuffer();
      const outputMimeType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";

      const uuid = crypto.randomUUID();
      const destKey =
        type === "avatar_image"
          ? `u/${session.user.id}/avatars/${uuid}_avatar.webp`
          : resolvedVoiceId
            ? voiceCoverImageKey({
                userId: session.user.id,
                voiceProfileId: resolvedVoiceId,
                voiceName: resolvedVoiceName || "voice",
                extension: ext,
              })
            : `u/${session.user.id}/drafts/covers/${uuid}_cover.${ext}`;

      const previous = await prisma.uploadAsset.findMany({
        where: {
          userId: session.user.id,
          type,
          ...(type === "voice_cover_image" ? { voiceProfileId: resolvedVoiceId ?? null } : { voiceProfileId: null }),
        },
        select: { id: true, storageKey: true },
      });
      const prevKeys = previous.map((p) => p.storageKey);

      await putObjectBytes({
        key: destKey,
        bytes: optimized,
        contentType: isAvatar ? "image/webp" : outputMimeType,
        cacheControl: isAvatar ? "private, max-age=31536000, immutable" : "private, no-cache",
      });

      // Create the new asset first so we never end up with "no avatar/cover" on partial failures.
      const asset = await prisma.uploadAsset.create({
        data: {
          userId: session.user.id,
          voiceProfileId: type === "voice_cover_image" ? (resolvedVoiceId ?? null) : null,
          type,
          fileName:
            isAvatar
              ? "avatar.webp"
              : resolvedVoiceId
                ? `${canonicalVoiceAssetBaseName(resolvedVoiceName || "voice")}.${ext}`
                : `cover.${ext}`,
          fileSize: optimized.length,
          mimeType: isAvatar ? "image/webp" : outputMimeType,
          storageKey: destKey,
        },
        select: { id: true },
      });

      if (type === "avatar_image") {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { image: "/api/users/avatar" },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "image.optimized",
          meta: { uploadAssetId: asset.id, type, voiceProfileId: resolvedVoiceId },
        },
      });

      // Best-effort cleanup: delete the original upload + any previous avatar/cover objects and rows.
      try {
        const uniq = Array.from(new Set([storageKey, ...prevKeys])).filter((key) => key && key !== destKey);
        if (uniq.length > 0) {
          await deleteObjects(uniq);
        }
      } catch {
        // Ignore cleanup errors to avoid failing a successful upload.
      }
      if (previous.length > 0) {
        try {
          await prisma.uploadAsset.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });
        } catch {
          // Ignore cleanup errors; old rows are harmless and will be shadowed by the newest asset.
        }
      }

      return ok({ asset });
    } catch (e) {
      return err("INTERNAL", e instanceof Error ? e.message : "Image processing failed", 500);
    }
  }

  let asset: { id: string };
  try {
    asset = await prisma.uploadAsset.create({
        data: {
          userId: session.user.id,
          voiceProfileId: resolvedVoiceId,
          type,
          fileName,
          fileSize: effectiveFileSize,
          mimeType: effectiveMimeType,
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

async function optimizeDatasetWav(input: Buffer) {
  const base = `ogvoice_${crypto.randomUUID()}`;
  const inPath = path.join(tmpdir(), `${base}_in.wav`);
  const outPath = path.join(tmpdir(), `${base}_out.wav`);

  try {
    await fs.writeFile(inPath, input);
    await runFfmpeg([
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inPath,
      "-ar",
      String(TARGET_DATASET_SAMPLE_RATE),
      "-ac",
      String(TARGET_DATASET_CHANNELS),
      "-c:a",
      "pcm_s16le",
      outPath,
    ]);

    const out = await fs.readFile(outPath);
    if (out.length < 44) {
      throw new Error("Optimized file is invalid.");
    }
    return out;
  } finally {
    await Promise.allSettled([fs.unlink(inPath), fs.unlink(outPath)]);
  }
}

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (e) => reject(new Error(`ffmpeg launch failed: ${e.message}`)));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const msg = stderr.trim();
      reject(new Error(msg || `ffmpeg failed with code ${code}`));
    });
  });
}
