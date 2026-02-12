import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { deleteObjects, sanitizeFileName } from "@/lib/storage/s3";

const renameSchema = z.object({
  assetId: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
});

const deleteSchema = z.object({
  assetId: z.string().min(1),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return err("INVALID_INPUT", "Invalid rename payload", 400, parsed.error.flatten());
  }

  const asset = await prisma.uploadAsset.findFirst({
    where: {
      id: parsed.data.assetId,
      userId: session.user.id,
      type: "generated_output",
    },
    select: { id: true },
  });
  if (!asset) return err("NOT_FOUND", "Generated file not found", 404);

  const nextName = sanitizeFileName(parsed.data.fileName);
  if (!nextName) return err("INVALID_INPUT", "Invalid file name", 400);

  const updated = await prisma.uploadAsset.update({
    where: { id: asset.id },
    data: { fileName: nextName },
    select: { id: true, fileName: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "generate.library.rename",
      meta: { assetId: updated.id, fileName: updated.fileName },
    },
  });

  return ok({ assetId: updated.id, fileName: updated.fileName });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return err("INVALID_INPUT", "Invalid delete payload", 400, parsed.error.flatten());
  }

  const asset = await prisma.uploadAsset.findFirst({
    where: {
      id: parsed.data.assetId,
      userId: session.user.id,
      type: "generated_output",
    },
    select: { id: true, storageKey: true },
  });
  if (!asset) return err("NOT_FOUND", "Generated file not found", 404);

  try {
    await deleteObjects([asset.storageKey]);
  } catch {
    return err("STORAGE_DELETE_FAILED", "Could not delete generated file from storage", 502);
  }

  await prisma.$transaction([
    prisma.generationJob.updateMany({
      where: { userId: session.user.id, outputAssetId: asset.id },
      data: { outputAssetId: null, outputKey: null },
    }),
    prisma.uploadAsset.delete({ where: { id: asset.id } }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "generate.library.delete",
        meta: { assetId: asset.id },
      },
    }),
  ]);

  return ok({ deleted: true, assetId: asset.id });
}

export const runtime = "nodejs";
