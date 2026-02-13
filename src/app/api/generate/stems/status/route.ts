import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { err, ok } from "@/lib/api-response";
import { env } from "@/lib/env";
import { advanceStemSeparationJob } from "@/lib/stem-separation";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);
  if (!env.MVSEP_API_TOKEN) {
    return err("SERVICE_UNAVAILABLE", "Stem separation is not configured yet.", 503);
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) return err("INVALID_INPUT", "jobId is required", 400);

  const job = await advanceStemSeparationJob({ userId: session.user.id, jobId });
  if (!job) return err("NOT_FOUND", "Stem separation job not found", 404);

  return ok({
    job: {
      id: job.jobId,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      errorMessage: job.errorMessage,
      outputs: job.outputs,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
  });
}

export const runtime = "nodejs";
