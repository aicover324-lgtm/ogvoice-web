import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { runpodStatus } from "@/lib/runpod";
import { deleteObjects } from "@/lib/storage/s3";

const querySchema = z.object({
  jobId: z.string().min(1),
});

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
    } else if (status === "FAILED") {
      await prisma.trainingJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          progress: job.progress,
          errorMessage:
            job.errorMessage || (st.error ? JSON.stringify(st.error).slice(0, 2000) : "RunPod failed"),
        },
      });
    } else {
      // IN_QUEUE / IN_PROGRESS etc
      const nextProgress =
        status === "IN_QUEUE" ? 5 : status === "IN_PROGRESS" ? 35 : status === "RUNNING" ? 35 : 15;
      await prisma.trainingJob.update({
        where: { id: job.id },
        data: {
          status: status === "IN_QUEUE" ? "queued" : "running",
          progress: Math.max(job.progress || 0, nextProgress),
        },
      });
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
