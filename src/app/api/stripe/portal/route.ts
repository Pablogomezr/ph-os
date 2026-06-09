import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";

/**
 * POST /api/stripe/portal
 * Body: { slug: string; returnUrl?: string }
 * Returns: { url: string } → redirige al Stripe Customer Portal
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { slug, returnUrl } = body as { slug: string; returnUrl?: string };

  if (!slug) {
    return NextResponse.json({ error: "slug es requerido" }, { status: 400 });
  }

  const db = getSuperadminDb();
  const building = await db
    .select({ stripeCustomerId: superadminSchema.buildings.stripeCustomerId })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Este edificio no tiene una suscripción activa de Stripe" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const origin = req.nextUrl.origin;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   building.stripeCustomerId,
    return_url: returnUrl ?? `${origin}/e/${slug}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
