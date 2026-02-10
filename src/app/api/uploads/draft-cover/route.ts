import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const asset = await prisma.uploadAsset.findFirst({
    where: { userId: session.user.id, voiceProfileId: null, type: "voice_cover_image" },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, fileSize: true, createdAt: true },
  });

  return ok({ asset });
}

export const runtime = "nodejs";
