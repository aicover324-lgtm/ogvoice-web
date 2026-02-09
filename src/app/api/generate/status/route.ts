import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) return err("INVALID_INPUT", "jobId is required", 400);

  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId: session.user.id },
    select: { id: true, status: true, progress: true, createdAt: true, updatedAt: true },
  });
  if (!job) return err("NOT_FOUND", "Generation job not found", 404);
  return ok({ job });
}

export const runtime = "nodejs";
