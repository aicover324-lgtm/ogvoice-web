import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { deleteObjects, presignGetObject } from "@/lib/storage/s3";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const asset = await prisma.uploadAsset.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, storageKey: true, fileName: true, mimeType: true, type: true },
  });
  if (!asset) return err("NOT_FOUND", "File not found", 404);

  const signed = await presignGetObject({ key: asset.storageKey });
  const u = new URL(req.url);
  if (u.searchParams.get("json") === "1") {
    return ok({
      assetId: asset.id,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      type: asset.type,
      url: signed,
    });
  }

  const res = NextResponse.redirect(signed);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const asset = await prisma.uploadAsset.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, storageKey: true, type: true, voiceProfileId: true },
  });
  if (!asset) return err("NOT_FOUND", "File not found", 404);

  // Dataset is immutable after voice creation.
  if (asset.type === "dataset_audio" && asset.voiceProfileId) {
    return err(
      "DATASET_LOCKED",
      "Dataset can only be changed while creating a new voice.",
      403
    );
  }

  // If the asset is tied to a voice, ensure the voice belongs to user.
  if (asset.voiceProfileId) {
    const voice = await prisma.voiceProfile.findFirst({
      where: { id: asset.voiceProfileId, userId: session.user.id },
      select: { id: true },
    });
    if (!voice) return err("FORBIDDEN", "You do not have access to this file", 403);
  }

  try {
    await deleteObjects([asset.storageKey]);
  } catch {
    return err("STORAGE_DELETE_FAILED", "Could not delete file from storage. Try again.", 502);
  }

  await prisma.uploadAsset.delete({ where: { id: asset.id } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "asset.delete",
      meta: { uploadAssetId: asset.id, voiceProfileId: asset.voiceProfileId, type: asset.type },
    },
  });

  return ok({ deleted: true });
}

export const runtime = "nodejs";
