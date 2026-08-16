import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { getOperatorContext } from "@/lib/operator-auth";

export default async function OperatorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();

  if (!userId) redirect(`/sign-in?redirect_url=/op/${slug}/lecturas`);

  const centralDb = getSuperadminDb();
  const building = await centralDb
    .select({ name: superadminSchema.buildings.name })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <p className="text-foreground font-bold">Edificio no encontrado.</p>
      </div>
    );
  }

  const ctx = await getOperatorContext(slug);

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#22D3EE]/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Sin acceso de operador</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tu cuenta no está registrada como operador en{" "}
            <strong>{building.name}</strong>. Pídele al administrador que te agregue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {children}
    </div>
  );
}
