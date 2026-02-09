import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const voice = await prisma.voiceProfile.findFirst({
    where: { id, userId: session.user.id, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!voice) return err("NOT_FOUND", "Deleted voice not found", 404);

  await prisma.voiceProfile.update({ where: { id }, data: { deletedAt: null } });
  await prisma.auditLog.create({ data: { userId: session.user.id, action: "voice.restore", meta: { voiceProfileId: id } } });
  return ok({ restored: true });
}

export const runtime = "nodejs";
