import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { presignGetObject } from "@/lib/storage/s3";
import { NextResponse } from "next/server";

const querySchema = z.object({
  versionId: z.string().min(1),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ versionId: url.searchParams.get("versionId") });
  if (!parsed.success) return err("INVALID_INPUT", "versionId is required", 400);

  const version = await prisma.voiceModelVersion.findUnique({
    where: { id: parsed.data.versionId },
    select: {
      id: true,
      modelArtifactKey: true,
      voiceProfile: { select: { userId: true } },
    },
  });
  if (!version || version.voiceProfile.userId !== session.user.id) {
    return err("NOT_FOUND", "Model version not found", 404);
  }

  if (version.modelArtifactKey.startsWith("external:")) {
    const url = version.modelArtifactKey.slice("external:".length);
    const u = new URL(req.url);
    if (u.searchParams.get("json") === "1") return ok({ url, type: "external" });
    return NextResponse.redirect(url);
  }

  const signed = await presignGetObject({ key: version.modelArtifactKey });
  const u = new URL(req.url);
  if (u.searchParams.get("json") === "1") return ok({ url: signed, type: "s3" });
  return NextResponse.redirect(signed);
}

export const runtime = "nodejs";
