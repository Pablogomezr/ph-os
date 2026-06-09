import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
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

  let activeModules: Module[] = ["base"];
  try {
    activeModules = JSON.parse(building.activeModules) as Module[];
  } catch {}

  const isSuperadmin = userId === process.env.SUPERADMIN_USER_ID;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
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
