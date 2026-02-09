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
  if (!env.STRIPE_PRICE_PRO_MONTHLY) return err("STRIPE_NOT_CONFIGURED", "Missing STRIPE_PRICE_PRO_MONTHLY", 500);

  const stripe = requireStripe();

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { subscription: true } });
  if (!user) return err("NOT_FOUND", "User not found", 404);

  const sub = user.subscription ??
    (await prisma.subscription.create({ data: { userId: user.id, status: "none", plan: "free" } }));

  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.subscription.update({ where: { id: sub.id }, data: { stripeCustomerId: customerId } });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRICE_PRO_MONTHLY, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${env.NEXT_PUBLIC_APP_URL}/app/settings?checkout=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancel`,
    subscription_data: {
      metadata: { userId: user.id },
    },
  });

  return ok({ url: checkout.url });
}

export const runtime = "nodejs";
