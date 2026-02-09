import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { runpodStatus } from "@/lib/runpod";

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
    },
  });
  if (!job) return err("NOT_FOUND", "Training job not found", 404);

  if (!job.runpodRequestId) return ok({ job });

  // Refresh status from RunPod
  try {
    const st = await runpodStatus(job.runpodRequestId);
    const status = String(st.status || "").toUpperCase();

    if (status === "COMPLETED") {
      await prisma.trainingJob.update({
        where: { id: job.id },
        data: { status: "succeeded", progress: 100 },
      });

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
