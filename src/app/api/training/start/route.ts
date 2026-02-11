import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { trainingDatasetWavKey, trainingModelZipKey, voiceDatasetFlacKey } from "@/lib/storage/keys";
import { copyObject } from "@/lib/storage/s3";
import { runpodRun } from "@/lib/runpod";

const schema = z.object({
  voiceProfileId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "voiceProfileId is required", 400);

  const voice = await prisma.voiceProfile.findFirst({
    where: { id: parsed.data.voiceProfileId, userId: session.user.id, deletedAt: null },
    select: { id: true, userId: true, name: true },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  const latestDataset = await prisma.uploadAsset.findFirst({
    where: { userId: session.user.id, voiceProfileId: voice.id, type: "dataset_audio" },
    orderBy: { createdAt: "desc" },
    select: { id: true, storageKey: true },
  });
  if (!latestDataset) return err("MISSING_DATASET", "Upload a dataset file first", 400);

  // Create a training job (gives us jobId for stable storage keys)
  const job = await prisma.trainingJob.create({
    data: {
      userId: session.user.id,
      voiceProfileId: voice.id,
      status: "queued",
      progress: 0,
      datasetAssetId: latestDataset.id,
    },
    select: { id: true },
  });

  const datasetKey = trainingDatasetWavKey({
    userId: session.user.id,
    voiceProfileId: voice.id,
    jobId: job.id,
    voiceName: voice.name,
  });
  const datasetArchiveKey = voiceDatasetFlacKey({
    userId: session.user.id,
    voiceProfileId: voice.id,
    voiceName: voice.name,
  });
  const outKey = trainingModelZipKey({
    userId: session.user.id,
    voiceProfileId: voice.id,
    jobId: job.id,
    voiceName: voice.name,
  });

  try {
    // Snapshot the dataset into the job-specific path (prevents mid-training replacement).
    await copyObject({ fromKey: latestDataset.storageKey, toKey: datasetKey });

    const runRes = await runpodRun({
      datasetKey,
      outKey,
      datasetArchiveKey,
      // Test defaults (runner also enforces these)
      totalEpoch: 1,
      batchSize: 4,
    });

    await prisma.trainingJob.update({
      where: { id: job.id },
      data: {
        status: "running",
        datasetKey,
        artifactKey: outKey,
        runpodRequestId: runRes.id,
      },
    });

    return ok({ jobId: job.id, runpodRequestId: runRes.id });
  } catch (e) {
    await prisma.trainingJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: e instanceof Error ? e.message : "Training start failed",
        datasetKey,
        artifactKey: outKey,
      },
    });
    return err("TRAINING_START_FAILED", e instanceof Error ? e.message : "Training start failed", 500);
  }
}

export const runtime = "nodejs";
