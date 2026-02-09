import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { presignGetObject } from "@/lib/storage/s3";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().min(1).optional(),
});

export async function GET(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id: voiceProfileId } = await ctx.params;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit"),
    cursor: url.searchParams.get("cursor") || undefined,
  });
  if (!parsed.success) return err("INVALID_INPUT", "Invalid query params", 400, parsed.error.flatten());

  const voice = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!voice) return err("NOT_FOUND", "Voice profile not found", 404);

  const take = parsed.data.limit + 1;
  const assets = await prisma.uploadAsset.findMany({
    where: { userId: session.user.id, voiceProfileId, type: "dataset_audio" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    ...(parsed.data.cursor
      ? {
          cursor: { id: parsed.data.cursor },
          skip: 1,
        }
      : {}),
  });

  const page = assets.slice(0, parsed.data.limit);
  const nextCursor = assets.length > parsed.data.limit ? page[page.length - 1]?.id : null;

  const links = await Promise.all(
    page.map(async (a) => ({
      assetId: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      storageKey: a.storageKey,
      downloadUrl: await presignGetObject({ key: a.storageKey }),
    }))
  );

  return ok({ voiceProfileId, links, nextCursor });
}

export const runtime = "nodejs";
