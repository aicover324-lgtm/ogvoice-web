import { z } from "zod";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import {
  canonicalImageExtension,
  canonicalVoiceAssetBaseName,
} from "@/lib/storage/keys";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const voices = await prisma.voiceProfile.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assets: true, versions: true } },
    },
  });

  return ok({ voices });
}

const createSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  language: z.string().max(32).optional(),
  datasetAssetId: z.string().min(1).optional(),
  coverAssetId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT", "Invalid voice profile payload", 400, parsed.error.flatten());

  let voice: { id: string };
  try {
    voice = await prisma.$transaction(async (db) => {
      const created = await db.voiceProfile.create({
        data: {
          userId: session.user.id,
          name: parsed.data.name,
          description: parsed.data.description,
          language: parsed.data.language,
        },
      });

      let coverId: string | null = null;
      let coverFileName: string | null = null;
      let coverMimeType: string | null = null;
      if (parsed.data.coverAssetId) {
        const cover = await db.uploadAsset.findFirst({
          where: {
            id: parsed.data.coverAssetId,
            userId: session.user.id,
            type: "voice_cover_image",
            voiceProfileId: null,
          },
          select: { id: true, fileName: true, mimeType: true },
        });
        if (!cover) {
          throw new Error("COVER_ASSET_INVALID");
        }
        coverId = cover.id;
        coverFileName = cover.fileName;
        coverMimeType = cover.mimeType;
      }

      if (parsed.data.datasetAssetId) {
        const asset = await db.uploadAsset.findFirst({
          where: {
            id: parsed.data.datasetAssetId,
            userId: session.user.id,
            type: "dataset_audio",
            voiceProfileId: null,
          },
          select: { id: true, storageKey: true },
        });
        if (!asset) {
          throw new Error("DATASET_ASSET_INVALID");
        }

        await db.uploadAsset.update({
          where: { id: asset.id },
          data: {
            voiceProfileId: created.id,
            fileName: `${canonicalVoiceAssetBaseName(parsed.data.name)}.wav`,
          },
        });
      } else {
        // Require dataset for MVP create flow.
        throw new Error("DATASET_ASSET_INVALID");
      }

      if (coverId) {
        const coverExt = canonicalImageExtension({ fileName: coverFileName, mimeType: coverMimeType });
        const coverFileNamed = `${canonicalVoiceAssetBaseName(parsed.data.name)}.${coverExt}`;

        await db.uploadAsset.update({
          where: { id: coverId },
          data: {
            voiceProfileId: created.id,
            fileName: coverFileNamed,
          },
        });
      }
      return created;
    }, {
      maxWait: 15_000,
      timeout: 120_000,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "DATASET_ASSET_INVALID") {
      return err("DATASET_REQUIRED", "Upload a dataset file before creating this voice.", 409);
    }
    if (e instanceof Error && e.message === "COVER_ASSET_INVALID") {
      return err("COVER_INVALID", "Cover image could not be attached. Try uploading it again.", 409);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2028") {
      return err(
        "CREATE_VOICE_TIMEOUT",
        "Dataset is large and processing took too long. Please click Create Voice again.",
        503
      );
    }
    return err("INTERNAL", "Could not create voice.", 500);
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "voice.create", meta: { voiceProfileId: voice.id } },
  });

  return ok({ voice });
}

export const runtime = "nodejs";
