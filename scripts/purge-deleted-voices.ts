import "dotenv/config";

import { env } from "@/lib/env";
import { purgeDeletedVoices } from "@/lib/purge";

async function main() {
  const retentionDays = env.PURGE_RETENTION_DAYS;
  const result = await purgeDeletedVoices({ retentionDays, limit: 50 });
  console.log(JSON.stringify({ ok: true, retentionDays, result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
