import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

const schema = z.object({
  voiceProfileId: z.string().min(1),
  inputAssetId: z.string().min(1).optional(),
  demoTrackId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid generate payload", 400, parsed.error.flatten());

  const voice = await prisma.voiceProfile.findFirst({
    where: { id: parsed.data.voiceProfileId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  if (parsed.data.inputAssetId) {
    const asset = await prisma.uploadAsset.findFirst({
      where: { id: parsed.data.inputAssetId, userId: session.user.id, type: "song_input" },
      select: { id: true },
    });
    if (!asset) return err("NOT_FOUND", "Input audio not found", 404);
  }

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

  // Placeholder behavior for MVP: immediately mark as succeeded.
  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "succeeded", progress: 100 },
  });

  return ok({ jobId: job.id });
}

export const runtime = "nodejs";
