import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";

/**
 * POST /api/stripe/checkout
 * Body: { slug: string; priceId: string }
 * Returns: { url: string } → redirige al Stripe Checkout
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { slug, priceId } = body as { slug: string; priceId: string };

  if (!slug || !priceId) {
    return NextResponse.json({ error: "slug y priceId son requeridos" }, { status: 400 });
  }

  const db = getSuperadminDb();
  const building = await db
    .select()
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building) {
    return NextResponse.json({ error: "Edificio no encontrado" }, { status: 404 });
  }

  const stripe = getStripe();
  let customerId = building.stripeCustomerId ?? undefined;

  // Crear cliente Stripe si no existe
  if (!customerId) {
    const customer = await stripe.customers.create({
      name:     building.name,
      metadata: { slug, buildingId: building.id },
    });
    customerId = customer.id;

    await db
      .update(superadminSchema.buildings)
      .set({ stripeCustomerId: customerId, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(superadminSchema.buildings.id, building.id));
  }

  const origin = req.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode:     "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/e/${slug}/billing?success=1`,
    cancel_url:  `${origin}/e/${slug}/billing?cancelled=1`,
    metadata:    { slug, buildingId: building.id },
    subscription_data: {
      metadata: { slug, buildingId: building.id },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
