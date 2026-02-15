import { env } from "@/lib/env";
import { err, ok } from "@/lib/api-response";
import { cleanupStaleDraftAssets, cleanupStaleGeneratedOutputs, purgeDeletedVoices } from "@/lib/purge";

export async function POST(req: Request) {
  if (!env.PURGE_CRON_SECRET) {
    return err("NOT_CONFIGURED", "Purge endpoint is not configured", 501);
  }
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== env.PURGE_CRON_SECRET) {
    return err("FORBIDDEN", "Invalid cron secret", 403);
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "20");
  const retentionDays = Number(url.searchParams.get("retentionDays") || String(env.PURGE_RETENTION_DAYS));
  const draftRetentionHours = Number(
    url.searchParams.get("draftRetentionHours") || String(env.UPLOAD_DRAFT_RETENTION_HOURS)
  );
  const generatedRetentionDays = Number(
    url.searchParams.get("generatedRetentionDays") || String(env.GENERATED_OUTPUT_RETENTION_DAYS)
  );

  const [voicePurge, draftCleanup, generatedCleanup] = await Promise.all([
    purgeDeletedVoices({
      retentionDays: Number.isFinite(retentionDays) ? retentionDays : env.PURGE_RETENTION_DAYS,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20,
    }),
    cleanupStaleDraftAssets({
      retentionHours: Number.isFinite(draftRetentionHours)
        ? Math.max(6, Math.min(24 * 90, draftRetentionHours))
        : env.UPLOAD_DRAFT_RETENTION_HOURS,
      limit: 400,
    }),
    cleanupStaleGeneratedOutputs({
      retentionDays: Number.isFinite(generatedRetentionDays)
        ? Math.max(1, Math.min(365, generatedRetentionDays))
        : env.GENERATED_OUTPUT_RETENTION_DAYS,
      limit: 500,
    }),
  ]);

  return ok({ voicePurge, draftCleanup, generatedCleanup });
}

export const runtime = "nodejs";
