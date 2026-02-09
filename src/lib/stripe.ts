import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    })
  : null;

export function requireStripe() {
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe;
}
