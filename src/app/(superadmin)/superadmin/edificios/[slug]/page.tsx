import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Building2, ChevronRight, CheckCircle, XCircle,
  Database, MapPin, Hash, Layers, ExternalLink,
} from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  base:          "Base (Unidades + Residentes)",
  finanzas:      "Finanzas",
  energia:       "Energía",
  mantenimiento: "Mantenimiento",
  pqrs:          "PQRS",
  mensajeria:    "Mensajería",
  contabilidad:  "Contabilidad",
};

export default async function EdificioDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getSuperadminDb();

  const building = await db
    .select()
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building) notFound();

  let modules: string[] = [];
  try { modules = JSON.parse(building.activeModules); } catch {}

  const isDevMode = building.tursoDbUrl.startsWith("file:");

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/superadmin" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/superadmin/edificios" className="hover:text-foreground">Edificios</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{building.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{building.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-mono text-muted-foreground">/{building.slug}</span>
              {building.status === "active" ? (
                <span className="flex items-center gap-1 text-xs text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Activo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" /> Suspendido
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                {building.plan}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/e/${building.slug}/dashboard`}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-4 py-2 rounded-lg transition-colors"
        >
          Ir al edificio <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Localización */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Localización</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-foreground">{building.city || <span className="text-muted-foreground italic">Sin ciudad</span>}</p>
            <p className="text-muted-foreground">{building.address || "Sin dirección"}</p>
            <p className="text-muted-foreground">{building.country}</p>
          </div>
        </div>

        {/* NIT / Identificación */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hash className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Identificación</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">NIT:</span>
              <span className="text-foreground font-mono">{building.nit || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Clerk Org:</span>
              <span className="text-foreground font-mono text-xs">{building.clerkOrgId}</span>
            </div>
          </div>
        </div>

        {/* Base de datos */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Base de datos</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isDevMode
                    ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                    : "bg-[#10B981]/10 text-[#10B981]"
                }`}
              >
                {isDevMode ? "SQLite Local (Dev)" : "Turso Cloud"}
              </span>
            </div>
            <p className="text-muted-foreground font-mono text-xs truncate">
              {building.tursoDbUrl}
            </p>
          </div>
        </div>

        {/* Módulos */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Módulos ({modules.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {modules.map((m) => (
              <span
                key={m}
                className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
              >
                {MODULE_LABELS[m] ?? m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Acciones rápidas</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/e/${building.slug}/dashboard`}
            className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Panel del edificio
          </Link>
          <Link
            href={`/e/${building.slug}/unidades`}
            className="text-sm bg-secondary text-foreground px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors border border-border"
          >
            Gestionar unidades
          </Link>
          <Link
            href={`/e/${building.slug}/residentes`}
            className="text-sm bg-secondary text-foreground px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors border border-border"
          >
            Ver residentes
          </Link>
        </div>
      </div>
    </div>
  );
}
