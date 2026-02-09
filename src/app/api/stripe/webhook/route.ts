import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { err, ok } from "@/lib/api-response";
import { requireStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: Request) {
  if (!env.STRIPE_SECRET_KEY) return err("STRIPE_NOT_CONFIGURED", "Missing STRIPE_SECRET_KEY", 500);
  if (!env.STRIPE_WEBHOOK_SECRET) return err("STRIPE_NOT_CONFIGURED", "Missing STRIPE_WEBHOOK_SECRET", 500);
  const stripe = requireStripe();

  const sig = (await headers()).get("stripe-signature");
  if (!sig) return err("INVALID_WEBHOOK", "Missing stripe-signature", 400);

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return err("INVALID_WEBHOOK", "Webhook signature verification failed", 400);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = (session.customer as string | null) ?? null;
      const subscriptionId = (session.subscription as string | null) ?? null;
      if (customerId && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscriptionFromStripe({ customerId, subscription: sub });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      await upsertSubscriptionFromStripe({ customerId, subscription });
      break;
    }
    default:
      break;
  }

  return ok({ received: true });
}

async function upsertSubscriptionFromStripe(args: { customerId: string; subscription: Stripe.Subscription }) {
  const userSub = await prisma.subscription.findFirst({ where: { stripeCustomerId: args.customerId } });
  if (!userSub) return;

  const status = String(args.subscription.status ?? "unknown");
  const plan = status === "active" || status === "trialing" ? "pro" : "free";
  const itemEnds = args.subscription.items?.data
    ? args.subscription.items.data.map((it) => it.current_period_end).filter((n) => typeof n === "number")
    : [];
  const currentPeriodEndUnix = itemEnds.length ? Math.max(...itemEnds) : null;
  const currentPeriodEnd = currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null;

  await prisma.subscription.update({
    where: { id: userSub.id },
    data: {
      stripeSubscriptionId: String(args.subscription.id),
      status,
      plan,
      currentPeriodEnd: currentPeriodEnd ?? undefined,
    },
  });
}

export const runtime = "nodejs";
