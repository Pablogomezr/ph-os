import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle, DollarSign, TrendingUp } from "lucide-react";
import Link from "next/link";

export default async function SuperadminDashboard() {
  const db = getSuperadminDb();
  const buildings = await db.select().from(superadminSchema.buildings);

  const activeBuildings = buildings.filter((b) => b.status === "active");
  const totalModules = buildings.reduce((acc, b) => {
    try {
      const modules: string[] = JSON.parse(b.activeModules);
      return acc + modules.filter((m) => m !== "base").length;
    } catch {
      return acc;
    }
  }, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de Control</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vista global de todos los edificios
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Edificios Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold font-mono text-foreground">
                {buildings.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Edificios Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#10B981]" />
              <span className="text-2xl font-bold font-mono text-foreground">
                {activeBuildings.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Módulos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#22D3EE]" />
              <span className="text-2xl font-bold font-mono text-foreground">
                {totalModules}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              MRR Estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-[#F59E0B]" />
              <span className="text-2xl font-bold font-mono text-foreground">
                —
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buildings list */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-foreground">Edificios Recientes</CardTitle>
          <Link
            href="/superadmin/edificios/nuevo"
            className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            + Nuevo Edificio
          </Link>
        </CardHeader>
        <CardContent>
          {buildings.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No hay edificios registrados aún.{" "}
              <Link href="/superadmin/edificios/nuevo" className="text-primary underline">
                Agregar el primero
              </Link>
            </p>
          ) : (
            <div className="divide-y divide-border">
              {buildings.map((b) => (
                <Link
                  key={b.id}
                  href={`/superadmin/edificios/${b.slug}`}
                  className="flex items-center justify-between py-3 hover:bg-secondary/30 px-2 rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.city} · {b.slug}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      b.status === "active"
                        ? "bg-[#10B981]/10 text-[#10B981]"
                        : "bg-[#EF4444]/10 text-[#EF4444]"
                    }`}
                  >
                    {b.status === "active" ? "Activo" : "Suspendido"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
