import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";

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

      if (parsed.data.datasetAssetId) {
        const asset = await db.uploadAsset.findFirst({
          where: {
            id: parsed.data.datasetAssetId,
            userId: session.user.id,
            type: "dataset_audio",
            voiceProfileId: null,
          },
          select: { id: true },
        });
        if (!asset) {
          throw new Error("DATASET_ASSET_INVALID");
        }
        await db.uploadAsset.update({
          where: { id: asset.id },
          data: { voiceProfileId: created.id },
        });
      } else {
        // Require dataset for MVP create flow.
        throw new Error("DATASET_ASSET_INVALID");
      }
      return created;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "DATASET_ASSET_INVALID") {
      return err("DATASET_REQUIRED", "Upload a dataset file before creating this voice.", 409);
    }
    return err("INTERNAL", "Could not create voice.", 500);
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "voice.create", meta: { voiceProfileId: voice.id } },
  });

  return ok({ voice });
}

export const runtime = "nodejs";
