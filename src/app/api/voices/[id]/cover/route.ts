import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { presignGetObject } from "@/lib/storage/s3";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id: voiceProfileId } = await ctx.params;
  const voice = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  const asset = await prisma.uploadAsset.findFirst({
    where: { userId: session.user.id, voiceProfileId, type: "voice_cover_image" },
    orderBy: { createdAt: "desc" },
    select: { storageKey: true },
  });
  if (!asset) return err("NOT_FOUND", "No cover", 404);

  const signed = await presignGetObject({ key: asset.storageKey });
  const res = NextResponse.redirect(signed);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const runtime = "nodejs";
