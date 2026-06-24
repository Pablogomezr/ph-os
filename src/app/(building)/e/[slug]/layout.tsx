import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import BuildingSidebar from "./_components/BuildingSidebar";
import type { Module } from "@/lib/modules/checker";

export default async function BuildingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/e/${slug}/dashboard`);
  }

  // Cargar edificio desde DB central
  const db = getSuperadminDb();
  const building = await db
    .select()
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building) notFound();

  if (building.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-2xl font-bold text-foreground">Edificio suspendido</p>
          <p className="text-muted-foreground text-sm">
            La cuenta de este edificio está suspendida. Contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  const isSuperadmin = userId === process.env.SUPERADMIN_USER_ID;

  // ── Control de acceso por edificio ───────────────────────────────────────────
  // El superadmin siempre tiene acceso. Cualquier otra persona debe tener un
  // registro activo en la tabla `users` de ESTE edificio (vinculado por email,
  // ya que el id de Clerk no se conoce hasta que el residente inicia sesión
  // por primera vez).
  if (!isSuperadmin) {
    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase();

    const tenantDb = await getTenantDb(slug);
    const member = email
      ? await tenantDb
          .select({
            id:     tenantSchema.users.id,
            active: tenantSchema.users.active,
            role:   tenantSchema.users.role,
          })
          .from(tenantSchema.users)
          .where(eq(tenantSchema.users.email, email))
          .get()
      : null;

    // Los propietarios y arrendatarios tienen su propio portal en /r/[slug] —
    // no el panel de administración. Si entran por aquí, los mandamos a su portal correcto.
    if (member && member.active === 1 && (member.role === "resident" || member.role === "tenant")) {
      redirect(`/r/${slug}/dashboard`);
    }

    if (!member || member.active !== 1) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-3 max-w-md px-6">
            <p className="text-2xl font-bold text-foreground">Sin acceso a este edificio</p>
            <p className="text-muted-foreground text-sm">
              Tu cuenta ({email ?? "sin email verificado"}) no está registrada como residente
              o administrador de <strong>{building.name}</strong>. Pide al administrador de tu
              copropiedad que te agregue en la sección de Residentes con este mismo correo.
            </p>
          </div>
        </div>
      );
    }
  }

  let activeModules: Module[] = ["base"];
  try {
    activeModules = JSON.parse(building.activeModules) as Module[];
  } catch {}

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      <BuildingSidebar
        slug={slug}
        buildingName={building.name}
        city={building.city}
        activeModules={activeModules}
        isSuperadmin={isSuperadmin}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
