import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const voice = await prisma.voiceProfile.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    include: {
      assets: { where: { type: "dataset_audio" }, orderBy: { createdAt: "desc" } },
      versions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);
  return ok({ voice });
}

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(500).nullable().optional(),
  language: z.string().max(32).nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid update payload", 400, parsed.error.flatten());

  const exists = await prisma.voiceProfile.findFirst({ where: { id, userId: session.user.id, deletedAt: null }, select: { id: true } });
  if (!exists) return err("NOT_FOUND", "Voice profile not found", 404);

  const voice = await prisma.voiceProfile.update({
    where: { id },
    data: parsed.data,
  });
  return ok({ voice });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const exists = await prisma.voiceProfile.findFirst({ where: { id, userId: session.user.id, deletedAt: null }, select: { id: true } });
  if (!exists) return err("NOT_FOUND", "Voice profile not found", 404);

  await prisma.voiceProfile.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: session.user.id, action: "voice.soft_delete", meta: { voiceProfileId: id } } });
  return ok({ deleted: true });
}

export const runtime = "nodejs";
