import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { env } from "@/lib/env";
import { createStemSeparationJob } from "@/lib/stem-separation";

const schema = z.object({
  inputAssetId: z.string().min(1),
  voiceProfileId: z.string().min(1).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);
  if (!env.MVSEP_API_TOKEN) {
    return err("SERVICE_UNAVAILABLE", "Stem separation is not configured yet.", 503);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return err("INVALID_INPUT", "Invalid stem separation payload", 400, parsed.error.flatten());
  }

  const voiceProfileId = parsed.data.voiceProfileId || null;
  if (voiceProfileId) {
    const voice = await prisma.voiceProfile.findFirst({
      where: { id: voiceProfileId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);
  }

  try {
    const job = await createStemSeparationJob({
      userId: session.user.id,
      inputAssetId: parsed.data.inputAssetId,
      voiceProfileId,
    });
    return ok({
      job: {
        id: job.jobId,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        message: job.message,
        errorMessage: job.errorMessage,
        outputs: job.outputs,
      },
    });
  } catch (e) {
    return err("STEM_START_FAILED", e instanceof Error ? e.message : "Could not start stem separation.", 500);
  }
}

export const runtime = "nodejs";
