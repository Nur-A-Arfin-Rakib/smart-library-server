import Stripe from "stripe";

export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const isStripeConfigured = (): boolean => stripe !== null;
