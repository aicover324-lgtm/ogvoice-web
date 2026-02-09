import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { err, ok } from "@/lib/api-response";
import { requireStripe } from "@/lib/stripe";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", "Sign in required", 401);
  if (!env.STRIPE_SECRET_KEY) return err("STRIPE_NOT_CONFIGURED", "Missing STRIPE_SECRET_KEY", 500);
  const stripe = requireStripe();

  const sub = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  if (!sub?.stripeCustomerId) return err("NO_CUSTOMER", "No Stripe customer found", 400);

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/app/settings`,
  });

  return ok({ url: portal.url });
}

export const runtime = "nodejs";
