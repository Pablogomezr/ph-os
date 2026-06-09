import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import BillingClient from "./BillingClient";
import type { PlanId } from "@/lib/plans";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<{ success?: string; cancelled?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug }          = await params;
  const { success, cancelled } = await searchParams;

  const db = getSuperadminDb();
  const building = await db
    .select({
      plan:                 superadminSchema.buildings.plan,
      status:               superadminSchema.buildings.status,
      stripeCustomerId:     superadminSchema.buildings.stripeCustomerId,
      stripeSubscriptionId: superadminSchema.buildings.stripeSubscriptionId,
    })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  const currentPlan: PlanId  = (building?.plan as PlanId) ?? "base";
  const buildingStatus        = building?.status ?? "active";
  const hasStripeCustomer     = !!building?.stripeCustomerId;
  const hasStripeSubscription = !!building?.stripeSubscriptionId;

  return (
    <div className="p-6 space-y-5">
      <BillingClient
        slug={slug}
        currentPlan={currentPlan}
        buildingStatus={buildingStatus}
        hasStripeCustomer={hasStripeCustomer}
        hasStripeSubscription={hasStripeSubscription}
        successParam={success === "1"}
        cancelledParam={cancelled === "1"}
        proPriceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL}
        enterprisePriceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_EMPRESARIAL}
      />
    </div>
  );
}
