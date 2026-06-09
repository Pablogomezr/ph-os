import { NextRequest, NextResponse } from "next/server";
import { getStripe, Stripe } from "@/lib/stripe";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getPlanFromPriceId } from "@/lib/plans";

/**
 * POST /api/webhooks/stripe
 * Verifica firma Stripe y procesa eventos de suscripción.
 *
 * Eventos manejados:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig     = req.headers.get("stripe-signature") ?? "";
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET no configurado");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getSuperadminDb();
  const now = Math.floor(Date.now() / 1000);

  const proPriceId        = process.env.STRIPE_PRICE_PROFESIONAL;
  const enterprisePriceId = process.env.STRIPE_PRICE_EMPRESARIAL;

  // ─── checkout.session.completed ─────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const slug           = session.metadata?.slug;
    const customerId     = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!slug || !subscriptionId) {
      return NextResponse.json({ received: true });
    }

    // Obtener detalles de la suscripción
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    const plan    = getPlanFromPriceId(priceId, proPriceId, enterprisePriceId);

    const building = await db
      .select({ id: superadminSchema.buildings.id })
      .from(superadminSchema.buildings)
      .where(eq(superadminSchema.buildings.slug, slug))
      .get();

    if (building) {
      await db
        .update(superadminSchema.buildings)
        .set({
          stripeCustomerId:     customerId,
          stripeSubscriptionId: subscriptionId,
          plan,
          status:    "active",
          updatedAt: now,
        })
        .where(eq(superadminSchema.buildings.id, building.id));

      // Registrar en tabla subscriptions
      await db.insert(superadminSchema.subscriptions).values({
        id:                   nanoid(),
        buildingId:           building.id,
        stripeSubscriptionId: subscriptionId,
        modules:              "[]",
        status:               subscription.status,
        currentPeriodStart:   subscription.items.data[0]?.current_period_start ?? now,
        currentPeriodEnd:     subscription.items.data[0]?.current_period_end   ?? now,
        createdAt:            now,
        updatedAt:            now,
      }).onConflictDoNothing();
    }
  }

  // ─── customer.subscription.updated ──────────────────────────────────────────
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId   = subscription.customer as string;
    const priceId      = subscription.items.data[0]?.price.id;
    const plan         = getPlanFromPriceId(priceId, proPriceId, enterprisePriceId);

    const stripeStatus = subscription.status; // active | past_due | canceled | etc.
    // Mapear status Stripe → status interno
    const internalStatus: "active" | "suspended" | "trial" =
      stripeStatus === "active"    ? "active"    :
      stripeStatus === "trialing"  ? "trial"     :
      stripeStatus === "canceled"  ? "suspended" :
                                     "active";

    await db
      .update(superadminSchema.buildings)
      .set({ plan, status: internalStatus, updatedAt: now })
      .where(eq(superadminSchema.buildings.stripeCustomerId, customerId));

    // Actualizar tabla subscriptions
    await db
      .update(superadminSchema.subscriptions)
      .set({
        status:             stripeStatus,
        currentPeriodStart: subscription.items.data[0]?.current_period_start ?? now,
        currentPeriodEnd:   subscription.items.data[0]?.current_period_end   ?? now,
        updatedAt:          now,
      })
      .where(eq(superadminSchema.subscriptions.stripeSubscriptionId, subscription.id));
  }

  // ─── customer.subscription.deleted ──────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId   = subscription.customer as string;

    // Downgrade a plan base
    await db
      .update(superadminSchema.buildings)
      .set({ plan: "base", status: "active", updatedAt: now })
      .where(eq(superadminSchema.buildings.stripeCustomerId, customerId));

    await db
      .update(superadminSchema.subscriptions)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(superadminSchema.subscriptions.stripeSubscriptionId, subscription.id));
  }

  return NextResponse.json({ received: true });
}
