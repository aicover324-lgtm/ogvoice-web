import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id: voiceProfileId } = await ctx.params;
  const voice = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  return err(
    "DATASET_LOCKED",
    "Dataset can only be replaced while creating a new voice.",
    403
  );
}

export const runtime = "nodejs";
