import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { err } from "@/lib/api-response";
import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { buildCoverPipelineConfig } from "@/lib/cover-pipeline";
import { dispatchCoverEngineJob } from "@/lib/cover-engine";

const schema = z.object({
  voiceProfileId: z.string().min(1),
  inputAssetId: z.string().min(1),
  pitch: z.number().int().min(-24).max(24).default(0),
  searchFeatureRatio: z.number().min(0).max(1).default(0.75),
  inferBackingVocals: z.boolean().default(false),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return err("INVALID_INPUT", "Invalid create cover payload", 400, parsed.error.flatten());
  }

  if (!env.COVER_ENGINE_URL) {
    return err(
      "COVER_ENGINE_NOT_CONFIGURED",
      "Create Cover is not configured yet in this environment.",
      503
    );
  }

  const voice = await prisma.voiceProfile.findFirst({
    where: { id: parsed.data.voiceProfileId, userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, modelArtifactKey: true },
      },
    },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  const latestModel = voice.versions[0] ?? null;
  if (!latestModel) {
    return err("MODEL_REQUIRED", "Clone this voice first before creating a cover.", 409);
  }

  const asset = await prisma.uploadAsset.findFirst({
    where: { id: parsed.data.inputAssetId, userId: session.user.id, type: "song_input" },
    select: { id: true, storageKey: true },
  });
  if (!asset) return err("NOT_FOUND", "Singing record not found", 404);

  const job = await prisma.generationJob.create({
    data: {
      userId: session.user.id,
      voiceProfileId: voice.id,
      inputAssetId: parsed.data.inputAssetId,
      status: "queued",
      progress: 0,
    },
    select: { id: true },
  });

  const config = buildCoverPipelineConfig({
    pitch: parsed.data.pitch,
    searchFeatureRatio: parsed.data.searchFeatureRatio,
    inferBackingVocals: parsed.data.inferBackingVocals,
  });

  try {
    const dispatched = await dispatchCoverEngineJob({
      jobId: job.id,
      userId: session.user.id,
      voiceProfileId: voice.id,
      inputAssetId: parsed.data.inputAssetId,
      inputStorageKey: asset.storageKey,
      modelArtifactKey: latestModel.modelArtifactKey,
      config,
    });

    const engineRequestId = dispatched.requestId?.trim();
    if (!engineRequestId) {
      throw new Error("Cover engine did not return a request id.");
    }

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "running",
        progress: 10,
        runpodRequestId: `cover:${engineRequestId}`,
        errorMessage: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "cover.requested",
        meta: {
          generationJobId: job.id,
          voiceProfileId: voice.id,
          voiceModelVersionId: latestModel.id,
          modelArtifactKey: latestModel.modelArtifactKey,
          inputAssetId: parsed.data.inputAssetId,
          engineRequestId,
          config,
        },
      },
    });
  } catch (e) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        progress: 0,
        errorMessage: e instanceof Error ? e.message : "Could not start cover job.",
      },
    });
    return err("COVER_START_FAILED", e instanceof Error ? e.message : "Could not start cover job.", 500);
  }

  return ok({ jobId: job.id });
}

export const runtime = "nodejs";
