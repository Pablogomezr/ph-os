import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { evaluarAccesoPanel } from "@/lib/auth/helpers";
import { notFound, redirect } from "next/navigation";
import BuildingSidebar from "./_components/BuildingSidebar";
import type { Module } from "@/lib/modules/checker";
import { getUnreadWhatsappCount } from "@/lib/whatsapp/unread";

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

  // ── Control de acceso por edificio ───────────────────────────────────────────
  // Misma regla que cada Server Action (ver lib/auth/acceso.ts): superadmin, o
  // admin/technician activo en la tabla `users` de ESTE edificio.
  const { decision, isSuperadmin, email, secciones } = await evaluarAccesoPanel(slug);

  if (!decision.permitido) {
    // Propietarios, arrendatarios y observadores tienen su propio portal.
    if (decision.motivo === "portal-residente") redirect(`/r/${slug}/dashboard`);
    if (decision.motivo === "portal-operario") redirect(`/op/${slug}/lecturas`);

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

  let activeModules: Module[] = ["base"];
  try {
    activeModules = JSON.parse(building.activeModules) as Module[];
  } catch {}

  const unreadWhatsapp = await getUnreadWhatsappCount(slug);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      <BuildingSidebar
        slug={slug}
        buildingName={building.name}
        city={building.city}
        activeModules={activeModules}
        isSuperadmin={isSuperadmin}
        secciones={secciones}
        unreadWhatsapp={unreadWhatsapp}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
