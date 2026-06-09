import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import Link from "next/link";
import { Building2, Plus, CheckCircle, XCircle } from "lucide-react";

export default async function EdificiosPage() {
  const db = getSuperadminDb();
  const buildings = await db.select().from(superadminSchema.buildings);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edificios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {buildings.length} copropiedad{buildings.length !== 1 ? "es" : ""} registrada{buildings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/superadmin/edificios/nuevo"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Edificio
        </Link>
      </div>

      {/* Lista */}
      {buildings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-foreground font-medium mb-1">No hay edificios registrados</p>
          <p className="text-muted-foreground text-sm mb-6">
            Crea tu primera copropiedad para comenzar.
          </p>
          <Link
            href="/superadmin/edificios/nuevo"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {buildings.map((b) => {
            let modules: string[] = [];
            try { modules = JSON.parse(b.activeModules); } catch {}

            return (
              <Link
                key={b.id}
                href={`/superadmin/edificios/${b.slug}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {b.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {b.city ? `${b.city} · ` : ""}/{b.slug}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Módulos badge */}
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {modules.length} módulo{modules.length !== 1 ? "s" : ""}
                  </span>

                  {/* Plan badge */}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium hidden sm:inline">
                    {b.plan}
                  </span>

                  {/* Status */}
                  {b.status === "active" ? (
                    <span className="flex items-center gap-1 text-xs text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Activo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" />
                      Suspendido
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
