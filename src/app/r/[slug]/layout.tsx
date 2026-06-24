import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq, inArray } from "drizzle-orm";
import { getResidentContext } from "@/lib/resident-auth";
import ResidentSidebar from "./_components/ResidentSidebar";

export default async function ResidentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();

  // 1. Auth: si no está logueado → sign-in con redirect de vuelta
  if (!userId) {
    redirect(`/sign-in?redirect_url=/r/${slug}/dashboard`);
  }

  // 2. El edificio debe existir en la DB central
  const centralDb = getSuperadminDb();
  const building = await centralDb
    .select({ name: superadminSchema.buildings.name })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-2xl font-bold text-foreground mb-2">Edificio no encontrado</p>
          <p className="text-muted-foreground text-sm">
            El enlace que seguiste no corresponde a ningún edificio registrado.
          </p>
        </div>
      </div>
    );
  }

  // 3. El residente debe estar registrado en el edificio (por email)
  const ctx = await getResidentContext(slug);

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#F59E0B]/10 flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">🏢</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">No estás registrado</h1>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Tu cuenta no está vinculada a ninguna unidad en <strong>{building.name}</strong>.
            Solicita al administrador del edificio que te registre con el email de tu cuenta.
          </p>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 font-mono">
            {/* email mostrado en el mensaje de error se resuelve en client */}
            Edificio: {building.name}
          </p>
        </div>
      </div>
    );
  }

  // 4. Obtener números de unidad del residente para el sidebar
  const db = await getTenantDb(slug);
  const units =
    ctx.unitIds.length > 0
      ? await db
          .select({ id: tenantSchema.units.id, number: tenantSchema.units.number })
          .from(tenantSchema.units)
          .where(inArray(tenantSchema.units.id, ctx.unitIds))
      : [];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      <ResidentSidebar
        slug={slug}
        buildingName={building.name}
        unitNumbers={units.map((u) => u.number)}
        userName={ctx.user.name}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
