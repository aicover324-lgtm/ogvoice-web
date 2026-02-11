import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

const schema = z.object({
  voiceProfileId: z.string().min(1),
  inputAssetId: z.string().min(1),
  pitch: z.number().int().min(-24).max(24).default(0),
  searchFeatureRatio: z.number().min(0).max(1).default(0.75),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid generate payload", 400, parsed.error.flatten());

  const voice = await prisma.voiceProfile.findFirst({
    where: { id: parsed.data.voiceProfileId, userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, modelArtifactKey: true } },
    },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);
  const latestModel = voice.versions[0] ?? null;
  if (!latestModel) {
    return err("MODEL_REQUIRED", "Clone this voice first before converting audio.", 409);
  }

  const asset = await prisma.uploadAsset.findFirst({
    where: { id: parsed.data.inputAssetId, userId: session.user.id, type: "song_input" },
    select: { id: true },
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

  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "inference.requested",
        meta: {
          generationJobId: job.id,
          voiceProfileId: voice.id,
          voiceModelVersionId: latestModel.id,
          modelArtifactKey: latestModel.modelArtifactKey,
          inputAssetId: parsed.data.inputAssetId,
          settings: {
            splitAudio: true,
            pitch: parsed.data.pitch,
            searchFeatureRatio: parsed.data.searchFeatureRatio,
            protectVoicelessConsonants: 0.33,
            pitchExtraction: "rmvpe",
            embedderModel: "contentvec",
            exportFormat: "WAV",
          },
        },
      },
    });
  } catch {
    // Do not block conversion flow on audit failures.
  }

  // Placeholder behavior for MVP: immediately mark as succeeded.
  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "succeeded", progress: 100 },
  });

  return ok({ jobId: job.id });
}

export const runtime = "nodejs";
