import { env } from "@/lib/env";
import { err, ok } from "@/lib/api-response";
import { purgeDeletedVoices } from "@/lib/purge";

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

  const result = await purgeDeletedVoices({
    retentionDays: Number.isFinite(retentionDays) ? retentionDays : env.PURGE_RETENTION_DAYS,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20,
  });

  return ok({ result });
}

export const runtime = "nodejs";
