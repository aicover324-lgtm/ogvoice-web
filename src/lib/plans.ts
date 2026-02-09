import { prisma } from "@/lib/prisma";

export type Plan = "free" | "pro";

export async function getUserPlan(userId: string): Promise<Plan> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return "free";
  const status = (sub.status || "").toLowerCase();
  if (status === "active" || status === "trialing") return "pro";
  return "free";
}
