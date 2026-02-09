import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimit(`register:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) return err("RATE_LIMITED", "Too many requests", 429, { resetAt: rl.resetAt });

  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err("INVALID_INPUT", "Invalid registration payload", 400, parsed.error.flatten());

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return err("EMAIL_TAKEN", "Email is already registered", 409);

    const passwordHash = await hash(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: parsed.data.name,
        subscription: { create: { status: "none", plan: "free" } },
        auditLogs: { create: { action: "auth.register", ip } },
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return ok({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    // Friendly error for vibecoders: DB not started.
    if (msg.includes("Can't reach database server") || msg.includes("PrismaClientInitializationError")) {
      return err(
        "DB_UNAVAILABLE",
        "Database is not running yet. Start Postgres (pnpm db:up) and then run pnpm prisma:migrate.",
        503
      );
    }
    return err("INTERNAL", "Registration failed due to a server error.", 500);
  }
}

export const runtime = "nodejs";
