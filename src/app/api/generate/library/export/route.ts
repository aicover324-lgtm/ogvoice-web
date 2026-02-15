import { Readable } from "node:stream";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { ZipFile } from "yazl";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { getObjectBytes, sanitizeFileName } from "@/lib/storage/s3";

const MAX_EXPORT_ITEMS = 50;
const MAX_SINGLE_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

const schema = z.object({
  assetIds: z.array(z.string().min(1)).min(1).max(MAX_EXPORT_ITEMS),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return err("INVALID_INPUT", "Invalid bulk export payload", 400, parsed.error.flatten());
  }

  const uniqueIds = Array.from(new Set(parsed.data.assetIds));
  const assets = await prisma.uploadAsset.findMany({
    where: {
      id: { in: uniqueIds },
      userId: session.user.id,
      type: "generated_output",
    },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      storageKey: true,
    },
  });

  if (assets.length !== uniqueIds.length) {
    return err("NOT_FOUND", "One or more selected tracks were not found", 404);
  }

  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const orderedAssets = uniqueIds.map((id) => assetById.get(id)).filter((a): a is NonNullable<typeof a> => !!a);

  for (const asset of orderedAssets) {
    if (asset.fileSize > MAX_SINGLE_FILE_BYTES) {
      return err("FILE_TOO_LARGE", `Track too large for ZIP export: ${asset.fileName}`, 413);
    }
  }

  const totalBytes = orderedAssets.reduce((sum, item) => sum + item.fileSize, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return err("ZIP_TOO_LARGE", "Selected tracks exceed ZIP export limit", 413, {
      maxTotalBytes: MAX_TOTAL_BYTES,
      requestedBytes: totalBytes,
    });
  }

  const zip = new ZipFile();
  const usedNames = new Set<string>();

  try {
    for (const asset of orderedAssets) {
      const bytes = await getObjectBytes({
        key: asset.storageKey,
        maxBytes: MAX_SINGLE_FILE_BYTES,
      });
      const name = pickUniqueZipName(asset.fileName || "track.wav", usedNames);
      zip.addBuffer(bytes, name);
    }
  } catch (e) {
    return err(
      "ZIP_EXPORT_FAILED",
      e instanceof Error ? e.message : "Could not prepare ZIP export",
      502
    );
  }

  zip.end();

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const fileName = `og-voice-library-${stamp}.zip`;

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "generate.library.export.zip",
      meta: {
        count: orderedAssets.length,
        totalBytes,
        assetIds: orderedAssets.map((a) => a.id),
      },
    },
  });

  const stream = Readable.toWeb(zip.outputStream as unknown as Readable) as ReadableStream;

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function pickUniqueZipName(rawName: string, used: Set<string>) {
  const safe = sanitizeFileName(rawName) || "track.wav";
  if (!used.has(safe)) {
    used.add(safe);
    return safe;
  }

  const dotIdx = safe.lastIndexOf(".");
  const hasExt = dotIdx > 0 && dotIdx < safe.length - 1;
  const base = hasExt ? safe.slice(0, dotIdx) : safe;
  const ext = hasExt ? safe.slice(dotIdx) : "";

  let idx = 2;
  while (idx < 9999) {
    const candidate = `${base}-${idx}${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    idx += 1;
  }

  const fallback = `${base}-${Date.now()}${ext}`;
  used.add(fallback);
  return fallback;
}

export const runtime = "nodejs";
