import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { err, ok } from "@/lib/api-response";
import { purgeVoiceNow } from "@/lib/purge";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await ctx.params;
  const res = await purgeVoiceNow({ userId: session.user.id, voiceProfileId: id });
  if (!res.ok && res.reason === "NOT_FOUND") return err("NOT_FOUND", "Voice not found", 404);
  if (!res.ok) return err("PURGE_FAILED", "Could not permanently delete this voice right now", 500);

  return ok({ purged: true, deletedDbAssets: res.deletedDbAssets, deletedStorageObjects: res.deletedStorageObjects });
}

export const runtime = "nodejs";
