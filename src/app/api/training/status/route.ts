import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { env } from "@/lib/env";
import { runpodCancel, runpodRun, runpodStatus } from "@/lib/runpod";
import { trainingCheckpointZipKey, trainingModelName, voiceDatasetFlacKey } from "@/lib/storage/keys";
import { deleteObjects } from "@/lib/storage/s3";

const querySchema = z.object({
  jobId: z.string().min(1),
});

const TERMINAL_FAILURE_STATUSES = new Set(["FAILED", "CANCELLED", "CANCELED", "TIMED_OUT", "ABORTED"]);
const QUEUED_STATUSES = new Set(["IN_QUEUE", "QUEUED"]);
const RUNNING_STATUSES = new Set(["IN_PROGRESS", "RUNNING", "PROCESSING"]);
const INFRA_AUTO_RETRY_MARKER = "[auto-retry:1]";
const INFRA_ERROR_HINTS = [
  "worker",
  "unavailable",
  "internal",
  "network",
  "timeout",
  "timed out",
  "gateway",
  "connection",
  "pod",
  "capacity",
  "node",
  "service",
];
const TRAINING_ERROR_HINTS = [
  "cuda out of memory",
  "out of memory",
  "nan",
  "dataset",
  "audio",
  "sample rate",
  "format",
  "shape mismatch",
  "file not found",
  "checkpoint",
  "assert",
  "valueerror",
  "runtimeerror",
  "keyerror",
  "indexerror",
  "traceback",
  "ffmpeg",
  "torchaudio",
  "librosa",
  "model",
  "train",
  "epoch",
  "loss",
];
const WATCHDOG_QUEUE_TIMEOUT_MS = env.TRAINING_WATCHDOG_QUEUE_TIMEOUT_SECONDS * 1000;
const WATCHDOG_HARD_TIMEOUT_MS = env.TRAINING_WATCHDOG_HARD_TIMEOUT_SECONDS * 1000;
const WATCHDOG_STALL_MS = env.TRAINING_WATCHDOG_STALL_SECONDS * 1000;
const WATCHDOG_OVERALL_TIMEOUT_MS = WATCHDOG_QUEUE_TIMEOUT_MS + WATCHDOG_HARD_TIMEOUT_MS;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ jobId: url.searchParams.get("jobId") });
  if (!parsed.success) return err("INVALID_INPUT", "jobId is required", 400);

  const job = await prisma.trainingJob.findFirst({
    where: { id: parsed.data.jobId, userId: session.user.id },
    select: {
      id: true,
      status: true,
      progress: true,
      errorMessage: true,
      runpodRequestId: true,
      artifactKey: true,
      voiceProfileId: true,
      datasetKey: true,
      datasetAssetId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!job) return err("NOT_FOUND", "Training job not found", 404);

  if (!job.runpodRequestId) return ok({ job });

  // Refresh status from RunPod
  try {
    const st = await runpodStatus(job.runpodRequestId);
    const status = String(st.status || "").toUpperCase();

    if (status === "COMPLETED") {
      const out = st.output && typeof st.output === "object" ? (st.output as Record<string, unknown>) : null;
      const datasetArchiveKey =
        out && typeof out.datasetArchiveKey === "string" ? (out.datasetArchiveKey as string) : null;
      const datasetArchiveBytes =
        out && typeof out.datasetArchiveBytes === "number" ? (out.datasetArchiveBytes as number) : null;

      await prisma.trainingJob.update({
        where: { id: job.id },
        data: { status: "succeeded", progress: 100 },
      });

      // If runner produced a FLAC archive, update the dataset asset to point at it
      // and delete the original WAV to save storage.
      if (datasetArchiveKey && job.datasetAssetId) {
        const asset = await prisma.uploadAsset.findFirst({
          where: { id: job.datasetAssetId, userId: session.user.id, type: "dataset_audio" },
          select: { id: true, storageKey: true, fileName: true },
        });

        if (asset) {
          const base = (asset.fileName || "dataset.wav").replace(/\.wav$/i, "");
          const nextName = `${base}.flac`;
          await prisma.uploadAsset.update({
            where: { id: asset.id },
            data: {
              storageKey: datasetArchiveKey,
              mimeType: "audio/flac",
              fileName: nextName,
              fileSize: datasetArchiveBytes ?? 0,
            },
          });

          // Delete the old WAV object (if different) and the job snapshot WAV.
          const toDelete = [asset.storageKey];
          if (job.datasetKey) toDelete.push(job.datasetKey);
          const uniq = Array.from(new Set(toDelete)).filter((k) => k && k !== datasetArchiveKey);
          if (uniq.length > 0) await deleteObjects(uniq);
        }
      }

      // Create model version if not created yet
      const existing = await prisma.voiceModelVersion.findFirst({
        where: { jobId: job.id },
        select: { id: true },
      });
      if (!existing && job.artifactKey) {
        await prisma.voiceModelVersion.create({
          data: {
            voiceProfileId: job.voiceProfileId,
            jobId: job.id,
            modelArtifactKey: job.artifactKey,
          },
        });
      }

      // Successful training no longer needs checkpoint archive.
      if (job.datasetAssetId) {
        const checkpointKey = trainingCheckpointZipKey({
          userId: session.user.id,
          voiceProfileId: job.voiceProfileId,
          datasetAssetId: job.datasetAssetId,
        });
        try {
          await deleteObjects([checkpointKey]);
        } catch {
          // Best-effort cleanup only.
        }
      }
    } else if (TERMINAL_FAILURE_STATUSES.has(status)) {
      const statusLabel = status === "CANCELED" ? "CANCELLED" : status;
      const errorText = st.error ? safeErrorText(st.error) : null;

      const failureKind = classifyFailureKind({ status: statusLabel, errorText });

      const shouldRetry =
        canUseInfraAutoRetry(job.errorMessage) &&
        !!job.datasetKey &&
        !!job.artifactKey &&
        !!job.datasetAssetId &&
        failureKind === "infrastructure";

      if (shouldRetry) {
        try {
          const checkpointKey = trainingCheckpointZipKey({
            userId: session.user.id,
            voiceProfileId: job.voiceProfileId,
            datasetAssetId: job.datasetAssetId!,
          });
          const retry = await runpodRun({
            datasetKey: job.datasetKey,
            outKey: job.artifactKey,
            checkpointKey,
            resumeFromCheckpoint: true,
            modelName: trainingModelName(job.voiceProfileId),
            totalEpoch: env.TRAINING_TOTAL_EPOCH_DEFAULT,
            batchSize: env.TRAINING_BATCH_SIZE_DEFAULT,
            saveEveryEpoch: env.TRAINING_SAVE_EVERY_EPOCH_DEFAULT,
            saveOnlyLatest: true,
          });

          await prisma.trainingJob.update({
            where: { id: job.id },
            data: {
              status: "queued",
              runpodRequestId: retry.id,
              progress: Math.max(job.progress || 0, 5),
              errorMessage: `${INFRA_AUTO_RETRY_MARKER} Auto-retry started after infrastructure failure.`,
            },
          });

          try {
            await prisma.auditLog.create({
              data: {
                userId: session.user.id,
                action: "training.auto_retry",
                meta: {
                  jobId: job.id,
                  previousRequestId: job.runpodRequestId,
                  retryRequestId: retry.id,
                  status: statusLabel,
                  failureKind,
                  error: errorText,
                },
              },
            });
          } catch {
            // Ignore audit failures.
          }
        } catch {
          // If retry scheduling fails, mark original job as failed below.
        }
      }

      const afterRetry = await prisma.trainingJob.findFirst({
        where: { id: job.id, userId: session.user.id },
        select: { status: true, runpodRequestId: true },
      });
      if (afterRetry?.status === "queued" && afterRetry.runpodRequestId && afterRetry.runpodRequestId !== job.runpodRequestId) {
        // Auto-retry was scheduled successfully.
      } else {
      const fallbackMessage =
        statusLabel === "CANCELLED"
          ? "Voice cloning failed (RunPod request cancelled)."
          : statusLabel === "TIMED_OUT"
            ? "Voice cloning failed (RunPod request timed out)."
            : "Voice cloning failed.";
      await prisma.trainingJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          progress: job.progress,
          errorMessage:
              errorText || fallbackMessage,
        },
      });
      await cleanupFailedStorageArtifacts({
        userId: session.user.id,
        voiceProfileId: job.voiceProfileId,
        datasetAssetId: job.datasetAssetId,
        datasetKey: job.datasetKey,
        artifactKey: job.artifactKey,
      });
      }
    } else {
      const now = Date.now();
      const createdAtMs = job.createdAt.getTime();
      const updatedAtMs = job.updatedAt.getTime();
      const ageMs = Math.max(0, now - createdAtMs);

      if (QUEUED_STATUSES.has(status)) {
        if (ageMs > WATCHDOG_QUEUE_TIMEOUT_MS) {
          await failTrainingJobWithWatchdog({
            userId: session.user.id,
            jobId: job.id,
            runpodRequestId: job.runpodRequestId,
            progress: job.progress || 0,
            voiceProfileId: job.voiceProfileId,
            datasetAssetId: job.datasetAssetId,
            datasetKey: job.datasetKey,
            artifactKey: job.artifactKey,
            reason: "queue_timeout",
            message: "Training stayed in queue too long and was stopped to protect your credits.",
          });
        } else if (job.status !== "queued" || (job.progress || 0) < 5) {
          await prisma.trainingJob.update({
            where: { id: job.id },
            data: {
              status: "queued",
              progress: Math.max(job.progress || 0, 5),
            },
          });
        }
      } else if (RUNNING_STATUSES.has(status)) {
        const currentProgress = Math.max(0, job.progress || 0);
        const executionMs = parseDurationMs((st as Record<string, unknown>).executionTime);
        const runtimeMsForProgress = executionMs ?? Math.max(0, ageMs - WATCHDOG_QUEUE_TIMEOUT_MS);
        const estimatedProgress = Math.min(95, 35 + Math.floor(runtimeMsForProgress / 30000));
        const nextProgress = Math.max(currentProgress, estimatedProgress);
        const progressAdvanced = nextProgress > currentProgress;

        const staleMs = Math.max(0, now - updatedAtMs);
        const hardTimedOut =
          (executionMs !== null && executionMs > WATCHDOG_HARD_TIMEOUT_MS) || ageMs > WATCHDOG_OVERALL_TIMEOUT_MS;
        const stalled = executionMs !== null && !progressAdvanced && staleMs > WATCHDOG_STALL_MS;

        if (hardTimedOut) {
          await failTrainingJobWithWatchdog({
            userId: session.user.id,
            jobId: job.id,
            runpodRequestId: job.runpodRequestId,
            progress: currentProgress,
            voiceProfileId: job.voiceProfileId,
            datasetAssetId: job.datasetAssetId,
            datasetKey: job.datasetKey,
            artifactKey: job.artifactKey,
            reason: "hard_timeout",
            message: "Training took too long and was stopped to protect your credits.",
          });
        } else if (stalled) {
          await failTrainingJobWithWatchdog({
            userId: session.user.id,
            jobId: job.id,
            runpodRequestId: job.runpodRequestId,
            progress: currentProgress,
            voiceProfileId: job.voiceProfileId,
            datasetAssetId: job.datasetAssetId,
            datasetKey: job.datasetKey,
            artifactKey: job.artifactKey,
            reason: "watchdog_stall",
            message: "Training appears stuck and was stopped to protect your credits.",
          });
        } else if (job.status !== "running" || progressAdvanced) {
          await prisma.trainingJob.update({
            where: { id: job.id },
            data: {
              status: "running",
              progress: nextProgress,
            },
          });
        }
      } else if (job.status !== "running" || (job.progress || 0) < 15) {
        await prisma.trainingJob.update({
          where: { id: job.id },
          data: {
            status: "running",
            progress: Math.max(job.progress || 0, 15),
          },
        });
      }
    }
  } catch {
    // Don't fail the endpoint just because status refresh failed.
  }

  const refreshed = await prisma.trainingJob.findFirst({
    where: { id: job.id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      progress: true,
      errorMessage: true,
      artifactKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok({ job: refreshed });
}

export const runtime = "nodejs";

async function failTrainingJobWithWatchdog(args: {
  userId: string;
  jobId: string;
  runpodRequestId: string | null;
  progress: number;
  voiceProfileId: string;
  datasetAssetId: string | null;
  datasetKey: string | null;
  artifactKey: string | null;
  reason: "queue_timeout" | "hard_timeout" | "watchdog_stall";
  message: string;
}) {
  if (args.runpodRequestId) {
    try {
      await runpodCancel(args.runpodRequestId);
    } catch {
      // Best-effort cancellation; job may already be terminal.
    }
  }

  await prisma.trainingJob.update({
    where: { id: args.jobId },
    data: {
      status: "failed",
      progress: args.progress,
      errorMessage: args.message,
    },
  });

  await cleanupFailedStorageArtifacts({
    userId: args.userId,
    voiceProfileId: args.voiceProfileId,
    datasetAssetId: args.datasetAssetId,
    datasetKey: args.datasetKey,
    artifactKey: args.artifactKey,
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: args.userId,
        action: "training.watchdog_fail",
        meta: {
          jobId: args.jobId,
          runpodRequestId: args.runpodRequestId,
          reason: args.reason,
          message: args.message,
        },
      },
    });
  } catch {
    // Ignore audit failures.
  }
}

async function cleanupFailedStorageArtifacts(args: {
  userId: string;
  voiceProfileId: string;
  datasetAssetId: string | null;
  datasetKey: string | null;
  artifactKey: string | null;
}) {
  const keys = new Set<string>();
  if (args.datasetKey) keys.add(args.datasetKey);
  if (args.artifactKey) keys.add(args.artifactKey);

  if (args.datasetAssetId) {
    const [asset, voice] = await Promise.all([
      prisma.uploadAsset.findFirst({
        where: {
          id: args.datasetAssetId,
          userId: args.userId,
          voiceProfileId: args.voiceProfileId,
          type: "dataset_audio",
        },
        select: { storageKey: true },
      }),
      prisma.voiceProfile.findFirst({
        where: { id: args.voiceProfileId, userId: args.userId, deletedAt: null },
        select: { name: true },
      }),
    ]);

    if (voice) {
      const archiveKey = voiceDatasetFlacKey({
        userId: args.userId,
        voiceProfileId: args.voiceProfileId,
        voiceName: voice.name,
      });
      if (!asset || asset.storageKey !== archiveKey) {
        keys.add(archiveKey);
      }
    }
  }

  if (keys.size > 0) {
    try {
      await deleteObjects(Array.from(keys));
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function parseDurationMs(raw: unknown) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    if (!Number.isInteger(raw) || raw < 1000) return Math.round(raw * 1000);
    return Math.round(raw);
  }
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (!s) return null;
    const ms = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*ms$/);
    if (ms) return Math.round(Number(ms[1] || 0));
    const sec = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*s$/);
    if (sec) return Math.round(Number(sec[1] || 0) * 1000);
    const min = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*m$/);
    if (min) return Math.round(Number(min[1] || 0) * 60_000);
    const hour = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*h$/);
    if (hour) return Math.round(Number(hour[1] || 0) * 3_600_000);
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return !Number.isInteger(n) || n < 1000 ? Math.round(n * 1000) : Math.round(n);
  }
  return null;
}

function canUseInfraAutoRetry(errorMessage: string | null) {
  if (!errorMessage) return true;
  return !errorMessage.includes(INFRA_AUTO_RETRY_MARKER);
}

function classifyFailureKind(args: { status: string; errorText: string | null }) {
  if (args.status === "CANCELLED") return "cancelled" as const;
  if (args.status === "TIMED_OUT" || args.status === "ABORTED") return "infrastructure" as const;

  const text = (args.errorText || "").toLowerCase();
  if (!text) return "unknown" as const;

  const looksTraining = TRAINING_ERROR_HINTS.some((hint) => text.includes(hint));
  if (looksTraining) return "training" as const;

  const looksInfra = INFRA_ERROR_HINTS.some((hint) => text.includes(hint));
  if (looksInfra) return "infrastructure" as const;

  return "unknown" as const;
}

function safeErrorText(err: unknown) {
  try {
    return JSON.stringify(err).slice(0, 2000);
  } catch {
    return String(err).slice(0, 2000);
  }
}
