import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { presignGetObject } from "@/lib/storage/s3";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const asset = await prisma.uploadAsset.findFirst({
    where: { userId: session.user.id, type: "avatar_image" },
    orderBy: { createdAt: "desc" },
    select: { storageKey: true },
  });
  if (!asset) return err("NOT_FOUND", "No avatar", 404);

  const signed = await presignGetObject({ key: asset.storageKey });
  // Avoid caching the redirect; signed URLs are short-lived.
  const res = NextResponse.redirect(signed);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const runtime = "nodejs";
