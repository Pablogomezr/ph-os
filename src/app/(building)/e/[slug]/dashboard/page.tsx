import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { getTenantDb } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  Home, Users, CircleDollarSign, Zap,
  Wrench, MessageCircle, Bell, FileSpreadsheet,
  ArrowRight, Building2,
} from "lucide-react";
import type { Module } from "@/lib/modules/checker";

const MODULE_CARDS: Record<
  Exclude<Module, "base">,
  { label: string; icon: React.ElementType; color: string; bg: string; href: string }
> = {
  finanzas:      { label: "Finanzas",      icon: CircleDollarSign, color: "text-[#6366F1]", bg: "bg-[#6366F1]/10", href: "finanzas" },
  energia:       { label: "Energía",       icon: Zap,              color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10", href: "energia" },
  mantenimiento: { label: "Mantenimiento", icon: Wrench,           color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", href: "mantenimiento" },
  pqrs:          { label: "PQRS",          icon: MessageCircle,    color: "text-[#10B981]", bg: "bg-[#10B981]/10", href: "pqrs" },
  mensajeria:    { label: "Mensajería",    icon: Bell,             color: "text-[#6366F1]", bg: "bg-[#6366F1]/10", href: "mensajeria" },
  contabilidad:  { label: "Contabilidad",  icon: FileSpreadsheet,  color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10", href: "contabilidad" },
};

export default async function BuildingDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();

  // Datos del edificio
  const centralDb = getSuperadminDb();
  const building = await centralDb
    .select()
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building) notFound();

  let activeModules: Module[] = ["base"];
  try { activeModules = JSON.parse(building.activeModules) as Module[]; } catch {}

  // Stats del tenant (unidades y residentes)
  let totalUnits = 0;
  let totalResidents = 0;
  try {
    const tenantDb = await getTenantDb(slug);
    const { tenantSchema } = await import("@/lib/db/tenant");
    const units = await tenantDb.select({ id: tenantSchema.units.id }).from(tenantSchema.units);
    const residents = await tenantDb.select({ id: tenantSchema.users.id }).from(tenantSchema.users);
    totalUnits = units.length;
    totalResidents = residents.length;
  } catch {
    // DB vacía o no accesible — OK en dev
  }

  const isSuperadmin = userId === process.env.SUPERADMIN_USER_ID;
  const extraModules = activeModules.filter((m) => m !== "base") as Exclude<Module, "base">[];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{building.name}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {building.city ? `${building.city} · ` : ""}
            {building.address ?? "Sin dirección"}
          </p>
        </div>
        {isSuperadmin && (
          <Link
            href={`/superadmin/edificios/${slug}`}
            className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors"
          >
            Ver en SuperAdmin ↗
          </Link>
        )}
      </div>

      {/* Stats base */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={Home}
          label="Unidades"
          value={totalUnits}
          color="text-[#6366F1]"
          bg="bg-[#6366F1]/10"
          href={`/e/${slug}/unidades`}
        />
        <StatCard
          icon={Users}
          label="Residentes"
          value={totalResidents}
          color="text-[#22D3EE]"
          bg="bg-[#22D3EE]/10"
          href={`/e/${slug}/residentes`}
        />
        <StatCard
          icon={Building2}
          label="Módulos activos"
          value={activeModules.length}
          color="text-[#10B981]"
          bg="bg-[#10B981]/10"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Plan"
          value={building.plan}
          color="text-[#F59E0B]"
          bg="bg-[#F59E0B]/10"
        />
      </div>

      {/* Acceso rápido a módulos activos */}
      {extraModules.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Módulos activos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {extraModules.map((mod) => {
              const meta = MODULE_CARDS[mod];
              if (!meta) return null;
              return (
                <Link
                  key={mod}
                  href={`/e/${slug}/${meta.href}`}
                  className="group flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                    <meta.icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Acciones rápidas base */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Gestión base</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/e/${slug}/unidades`}
            className="group flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#6366F1]/10 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5 text-[#6366F1]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Unidades</p>
              <p className="text-xs text-muted-foreground">{totalUnits} registradas</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            href={`/e/${slug}/residentes`}
            className="group flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#22D3EE]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Residentes</p>
              <p className="text-xs text-muted-foreground">{totalResidents} registrados</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </section>
    </div>
  );
}

// ── Componente helper StatCard ─────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  href?: string;
}) {
  const content = (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
