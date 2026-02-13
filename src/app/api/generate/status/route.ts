import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { runpodStatus } from "@/lib/runpod";
import { pollCoverEngineJob } from "@/lib/cover-engine";
import { deleteObjects } from "@/lib/storage/s3";
import { presignGetObject } from "@/lib/storage/s3";
import { canonicalVoiceAssetBaseName } from "@/lib/storage/keys";

const TERMINAL_FAILURE_STATUSES = new Set(["FAILED", "CANCELLED", "CANCELED", "TIMED_OUT", "ABORTED"]);
const QUEUED_STATUSES = new Set(["IN_QUEUE", "QUEUED"]);
const RUNNING_STATUSES = new Set(["IN_PROGRESS", "RUNNING", "PROCESSING"]);
const COVER_QUEUED_STATUSES = new Set(["QUEUED", "PENDING", "IN_QUEUE", "SUBMITTED", "RECEIVED"]);
const COVER_RUNNING_STATUSES = new Set(["RUNNING", "IN_PROGRESS", "PROCESSING", "STARTED"]);
const COVER_SUCCESS_STATUSES = new Set(["SUCCEEDED", "SUCCESS", "COMPLETED", "DONE", "FINISHED"]);
const COVER_FAILURE_STATUSES = new Set(["FAILED", "ERROR", "CANCELLED", "CANCELED", "TIMED_OUT", "ABORTED"]);

type StemKeys = {
  mainVocalsKey: string | null;
  backVocalsKey: string | null;
  instrumentalKey: string | null;
};

type StemPreview = {
  mainVocalsUrl: string | null;
  backVocalsUrl: string | null;
  instrumentalUrl: string | null;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) return err("INVALID_INPUT", "jobId is required", 400);

  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId: session.user.id },
    select: {
      id: true,
      userId: true,
      voiceProfileId: true,
      inputAssetId: true,
      status: true,
      progress: true,
      runpodRequestId: true,
      outputKey: true,
      outputAssetId: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      voiceProfile: { select: { name: true } },
    },
  });
  if (!job) return err("NOT_FOUND", "Conversion session not found", 404);

  if (!job.runpodRequestId) {
    return ok({
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        errorMessage: job.errorMessage,
        outputAssetId: job.outputAssetId,
        stemPreview: null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  }

  let stemPreview: StemPreview | null = null;
  const jobProgress = job.progress || 0;
  let jobMutated = false;

  try {
    const isCoverJob = job.runpodRequestId.startsWith("cover:");
    if (isCoverJob) {
      const requestId = job.runpodRequestId.slice("cover:".length);
      const st = await pollCoverEngineJob(requestId);
      const status = normalizeCoverStatus(st.status);

      if (COVER_SUCCESS_STATUSES.has(status)) {
        stemPreview = await buildStemPreviewUrls(st.stemKeys, session.user.id);
        const outputKey = st.outputKey || job.outputKey;
        const outputBytes = st.outputBytes;
        const missingOutputMessage = "Cover completed but output file is missing.";

        if (!outputKey) {
          if (job.status !== "failed" || job.errorMessage !== missingOutputMessage) {
            await prisma.generationJob.update({
              where: { id: job.id },
              data: {
                status: "failed",
                errorMessage: missingOutputMessage,
              },
            });
            jobMutated = true;
          }
        } else if (!job.outputAssetId) {
          const inputSongSuffix = await buildInputSongSuffix(session.user.id, job.inputAssetId);
          const fileName = `${canonicalVoiceAssetBaseName(job.voiceProfile.name)}-cover${inputSongSuffix}.wav`;
          const created = await prisma.uploadAsset.create({
            data: {
              userId: session.user.id,
              voiceProfileId: job.voiceProfileId,
              type: "generated_output",
              fileName,
              fileSize: outputBytes ?? 0,
              mimeType: "audio/wav",
              storageKey: outputKey,
            },
            select: { id: true },
          });

          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: "succeeded",
              progress: 100,
              outputKey,
              outputAssetId: created.id,
              errorMessage: null,
            },
          });
          jobMutated = true;
        } else {
          const shouldSyncSuccessState =
            job.status !== "succeeded" ||
            job.progress !== 100 ||
            job.outputKey !== outputKey ||
            job.errorMessage !== null;

          if (shouldSyncSuccessState) {
            await prisma.generationJob.update({
              where: { id: job.id },
              data: {
                status: "succeeded",
                progress: 100,
                outputKey,
                errorMessage: null,
              },
            });
            jobMutated = true;
          }
        }
      } else if (COVER_FAILURE_STATUSES.has(status)) {
        const msg = toUserFacingCoverFailure({ status, error: st.errorMessage });
        const shouldMarkFailed = job.status !== "failed" || job.errorMessage !== msg;
        if (shouldMarkFailed) {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: "failed",
              errorMessage: msg,
            },
          });
          jobMutated = true;
        }
        if (job.outputKey && shouldMarkFailed) {
          try {
            await deleteObjects([job.outputKey]);
          } catch {
            // Best-effort cleanup.
          }
        }
      } else {
        const normalizedProgress =
          typeof st.progress === "number"
            ? Math.max(10, Math.min(95, Math.floor(st.progress)))
            : COVER_QUEUED_STATUSES.has(status)
              ? 12
              : COVER_RUNNING_STATUSES.has(status)
                ? 60
                : 25;
        const nextStatus = COVER_QUEUED_STATUSES.has(status) ? "queued" : "running";
        const nextProgress = Math.max(jobProgress, normalizedProgress);
        if (job.status !== nextStatus || jobProgress !== nextProgress) {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: nextStatus,
              progress: nextProgress,
            },
          });
          jobMutated = true;
        }
      }
    } else {
      const st = await runpodStatus(job.runpodRequestId);
      const status = String(st.status || "").toUpperCase();
      const out = st.output && typeof st.output === "object" ? (st.output as Record<string, unknown>) : null;

      if (status === "COMPLETED") {
        stemPreview = await buildStemPreviewUrls(extractStemKeys(out), session.user.id);
        const outputKey =
          out && typeof out.outputKey === "string"
            ? out.outputKey
            : out && typeof out.outKey === "string"
              ? out.outKey
              : job.outputKey;
        const outputBytes = out && typeof out.outputBytes === "number" ? out.outputBytes : null;
        const missingOutputMessage = "Conversion completed but output file is missing.";

        if (!outputKey) {
          if (job.status !== "failed" || job.errorMessage !== missingOutputMessage) {
            await prisma.generationJob.update({
              where: { id: job.id },
              data: {
                status: "failed",
                errorMessage: missingOutputMessage,
              },
            });
            jobMutated = true;
          }
        } else if (!job.outputAssetId) {
          const inputSongSuffix = await buildInputSongSuffix(session.user.id, job.inputAssetId);
          const fileName = `${canonicalVoiceAssetBaseName(job.voiceProfile.name)}-converted${inputSongSuffix}.wav`;
          const created = await prisma.uploadAsset.create({
            data: {
              userId: session.user.id,
              voiceProfileId: job.voiceProfileId,
              type: "generated_output",
              fileName,
              fileSize: outputBytes ?? 0,
              mimeType: "audio/wav",
              storageKey: outputKey,
            },
            select: { id: true },
          });

          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: "succeeded",
              progress: 100,
              outputKey,
              outputAssetId: created.id,
              errorMessage: null,
            },
          });
          jobMutated = true;
        } else {
          const shouldSyncSuccessState =
            job.status !== "succeeded" ||
            job.progress !== 100 ||
            job.outputKey !== outputKey ||
            job.errorMessage !== null;

          if (shouldSyncSuccessState) {
            await prisma.generationJob.update({
              where: { id: job.id },
              data: {
                status: "succeeded",
                progress: 100,
                outputKey,
                errorMessage: null,
              },
            });
            jobMutated = true;
          }
        }
      } else if (TERMINAL_FAILURE_STATUSES.has(status)) {
        const msg = toUserFacingFailure({ status, error: st.error });
        const shouldMarkFailed = job.status !== "failed" || job.errorMessage !== msg;
        if (shouldMarkFailed) {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: "failed",
              errorMessage: msg,
            },
          });
          jobMutated = true;
        }
        if (job.outputKey && shouldMarkFailed) {
          try {
            await deleteObjects([job.outputKey]);
          } catch {
            // Best-effort cleanup.
          }
        }
      } else {
        const nextProgress = QUEUED_STATUSES.has(status) ? 10 : RUNNING_STATUSES.has(status) ? 55 : 25;
        const nextStatus = QUEUED_STATUSES.has(status) ? "queued" : "running";
        const mergedProgress = Math.max(jobProgress, nextProgress);
        if (job.status !== nextStatus || jobProgress !== mergedProgress) {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: nextStatus,
              progress: mergedProgress,
            },
          });
          jobMutated = true;
        }
      }
    }
  } catch {
    // Keep endpoint resilient if provider status call fails.
  }

  if (!jobMutated) {
    return ok({
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        errorMessage: job.errorMessage,
        outputAssetId: job.outputAssetId,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        stemPreview,
      },
    });
  }

  const refreshed = await prisma.generationJob.findFirst({
    where: { id: job.id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      progress: true,
      errorMessage: true,
      outputAssetId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok({
    job: refreshed
      ? {
          ...refreshed,
          stemPreview,
        }
      : null,
  });
}

function extractStemKeys(out: Record<string, unknown> | null): StemKeys {
  const stemObj = out?.stemKeys && typeof out.stemKeys === "object" ? (out.stemKeys as Record<string, unknown>) : null;
  return {
    mainVocalsKey:
      firstString(stemObj?.mainVocalsKey, out?.mainVocalsKey) || null,
    backVocalsKey:
      firstString(stemObj?.backVocalsKey, out?.backVocalsKey) || null,
    instrumentalKey:
      firstString(stemObj?.instrumentalKey, out?.instrumentalKey) || null,
  };
}

async function buildStemPreviewUrls(stems: StemKeys, userId: string): Promise<StemPreview | null> {
  if (!stems.mainVocalsKey && !stems.backVocalsKey && !stems.instrumentalKey) return null;

  const keys = [stems.mainVocalsKey, stems.backVocalsKey, stems.instrumentalKey];
  if (keys.some((k) => k && !isLikelyOwnedKey(k, userId))) {
    return null;
  }

  const [mainVocalsUrl, backVocalsUrl, instrumentalUrl] = await Promise.all([
    stems.mainVocalsKey ? presignGetObject({ key: stems.mainVocalsKey }).catch(() => null) : Promise.resolve(null),
    stems.backVocalsKey ? presignGetObject({ key: stems.backVocalsKey }).catch(() => null) : Promise.resolve(null),
    stems.instrumentalKey ? presignGetObject({ key: stems.instrumentalKey }).catch(() => null) : Promise.resolve(null),
  ]);

  return {
    mainVocalsUrl,
    backVocalsUrl,
    instrumentalUrl,
  };
}

function isLikelyOwnedKey(key: string, userId: string) {
  return key.startsWith(`u/${userId}/`) || key.includes(`/u/${userId}/`);
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function toUserFacingFailure(args: { status: string; error: unknown }) {
  const label = args.status === "CANCELED" ? "CANCELLED" : args.status;
  const text = safeErrorText(args.error).toLowerCase();

  if (label === "CANCELLED") return "Voice conversion stopped because the request was cancelled.";
  if (label === "TIMED_OUT") return "Voice conversion took too long and was stopped.";
  if (text.includes("network") || text.includes("gateway") || text.includes("worker")) {
    return "Voice conversion failed because of a temporary server issue.";
  }
  return "Voice conversion failed. Please try again.";
}

function safeErrorText(err: unknown) {
  if (err === null || err === undefined) return "";
  try {
    return JSON.stringify(err).slice(0, 2000);
  } catch {
    return String(err).slice(0, 2000);
  }
}

function normalizeCoverStatus(status: string) {
  return String(status || "").trim().replaceAll("-", "_").replaceAll(" ", "_").toUpperCase();
}

function toUserFacingCoverFailure(args: { status: string; error: unknown }) {
  const label = args.status === "CANCELED" ? "CANCELLED" : args.status;
  const text = safeErrorText(args.error).toLowerCase();

  if (label === "CANCELLED") return "Cover generation stopped because the request was cancelled.";
  if (label === "TIMED_OUT") return "Cover generation took too long and was stopped.";
  if (text.includes("network") || text.includes("gateway") || text.includes("worker")) {
    return "Cover generation failed because of a temporary server issue.";
  }
  return "Cover generation failed. Please try again.";
}

async function buildInputSongSuffix(userId: string, inputAssetId: string | null) {
  if (!inputAssetId) return "";

  const asset = await prisma.uploadAsset.findFirst({
    where: { id: inputAssetId, userId, type: "song_input" },
    select: { fileName: true },
  });

  const baseName = stripFileExtension(asset?.fileName || "").trim();
  if (!baseName) return "";

  const normalized = baseName
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "-")
    .replace(/[-_]{2,}/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 48);

  if (!normalized) return "";
  return `_${normalized}`;
}

function stripFileExtension(fileName: string) {
  if (!fileName) return "";
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}

export const runtime = "nodejs";
