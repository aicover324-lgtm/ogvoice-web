import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { runpodStatus } from "@/lib/runpod";
import { deleteObjects } from "@/lib/storage/s3";
import { canonicalVoiceAssetBaseName } from "@/lib/storage/keys";

const TERMINAL_FAILURE_STATUSES = new Set(["FAILED", "CANCELLED", "CANCELED", "TIMED_OUT", "ABORTED"]);
const QUEUED_STATUSES = new Set(["IN_QUEUE", "QUEUED"]);
const RUNNING_STATUSES = new Set(["IN_PROGRESS", "RUNNING", "PROCESSING"]);

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
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  }

  try {
    const st = await runpodStatus(job.runpodRequestId);
    const status = String(st.status || "").toUpperCase();

    if (status === "COMPLETED") {
      const out = st.output && typeof st.output === "object" ? (st.output as Record<string, unknown>) : null;
      const outputKey =
        out && typeof out.outputKey === "string"
          ? out.outputKey
          : out && typeof out.outKey === "string"
            ? out.outKey
            : job.outputKey;
      const outputBytes = out && typeof out.outputBytes === "number" ? out.outputBytes : null;

      if (!outputKey) {
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage: "Conversion completed but output file is missing.",
          },
        });
      } else if (!job.outputAssetId) {
        const fileName = `${canonicalVoiceAssetBaseName(job.voiceProfile.name)}-converted.wav`;
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
      } else {
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: "succeeded",
            progress: 100,
            outputKey,
            errorMessage: null,
          },
        });
      }
    } else if (TERMINAL_FAILURE_STATUSES.has(status)) {
      const msg = toUserFacingFailure({ status, error: st.error });
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage: msg,
        },
      });
      if (job.outputKey) {
        try {
          await deleteObjects([job.outputKey]);
        } catch {
          // Best-effort cleanup.
        }
      }
    } else {
      const nextProgress = QUEUED_STATUSES.has(status) ? 10 : RUNNING_STATUSES.has(status) ? 55 : 25;
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: QUEUED_STATUSES.has(status) ? "queued" : "running",
          progress: Math.max(job.progress || 0, nextProgress),
        },
      });
    }
  } catch {
    // Keep endpoint resilient if provider status call fails.
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

  return ok({ job: refreshed });
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

export const runtime = "nodejs";
