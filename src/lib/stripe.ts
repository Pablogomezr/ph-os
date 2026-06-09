/**
 * Stripe server-side singleton.
 * NUNCA importar desde Client Components — solo server/route handlers.
 */
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY no está configurado. Agrégalo en .env.local"
    );
  }
  // apiVersion is optional; SDK defaults to latest ("2026-05-27.dahlia")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" as any });
  return _stripe;
}

export { Stripe };
