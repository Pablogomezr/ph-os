"use client";

import { useActionState, useState, useTransition, useEffect, useRef, useMemo } from "react";
import { createUnit, updateUnit, deleteUnit, type UnitFormState } from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Plus, Trash2, Loader2, Home, Pencil, Search } from "lucide-react";
import type { tenantSchema } from "@/lib/db/tenant";

type Unit = typeof tenantSchema.units.$inferSelect;

const UNIT_TYPES = [
  { value: "apartment",  label: "Apartamento" },
  { value: "office",     label: "Oficina" },
  { value: "commercial", label: "Local comercial" },
  { value: "parking",    label: "Parqueadero" },
  { value: "warehouse",  label: "Bodega" },
];

const STATUS_OPTIONS = [
  { value: "occupied",    label: "Ocupada" },
  { value: "vacant",      label: "Vacía" },
  { value: "maintenance", label: "En mantenimiento" },
];

const STATUS_STYLE: Record<string, string> = {
  occupied:    "bg-[#10B981]/10 text-[#10B981]",
  vacant:      "bg-[#F59E0B]/10 text-[#F59E0B]",
  maintenance: "bg-[#EF4444]/10 text-[#EF4444]",
};
const STATUS_LABEL: Record<string, string> = {
  occupied: "Ocupada", vacant: "Vacía", maintenance: "En mantenimiento",
};

export default function UnidadesClient({
  slug,
  units,
}: {
  slug: string;
  units: Unit[];
}) {
  const [open, setOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const [search, setSearch] = useState("");
  // Evita mostrar un error de un intento anterior al reabrir el panel para
  // editar la misma unidad — solo se muestra tras un envío real de este panel.
  const [sheetSubmitted, setSheetSubmitted] = useState(false);

  const createUnitBound = createUnit.bind(null, slug);
  const [createState, createFormAction, isCreating] = useActionState<UnitFormState, FormData>(
    createUnitBound,
    null
  );

  const updateUnitBound = updateUnit.bind(null, slug, editingUnit?.id ?? "");
  const [updateState, updateFormAction, isUpdating] = useActionState<UnitFormState, FormData>(
    updateUnitBound,
    null
  );

  const isEditing = editingUnit !== null;
  const state = isEditing ? updateState : createState;
  const formAction = isEditing ? updateFormAction : createFormAction;
  const isPending = isEditing ? isUpdating : isCreating;

  // Cerrar sheet al guardar — comparamos por referencia para detectar CADA éxito
  const handledStateRef = useRef<UnitFormState>(null);
  useEffect(() => {
    if (state?.success && state !== handledStateRef.current) {
      handledStateRef.current = state;
      setOpen(false);
      setEditingUnit(null);
      setSheetSubmitted(false);
    }
  }, [state]);

  function handleOpenCreate() {
    setEditingUnit(null);
    setSheetSubmitted(false);
    setOpen(true);
  }

  function handleOpenEdit(u: Unit) {
    setEditingUnit(u);
    setSheetSubmitted(false);
    setOpen(true);
  }

  function handleDelete(unitId: string) {
    if (!confirm("¿Eliminar esta unidad? Esta acción no se puede deshacer.")) return;
    setDeletingId(unitId);
    startDeleteTransition(async () => {
      await deleteUnit(slug, unitId);
      setDeletingId(null);
    });
  }

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter(u =>
      u.number.toLowerCase().includes(q) ||
      (UNIT_TYPES.find(t => t.value === u.type)?.label ?? u.type).toLowerCase().includes(q) ||
      (STATUS_LABEL[u.status] ?? u.status).toLowerCase().includes(q) ||
      (u.costCenter ?? "").toLowerCase().includes(q) ||
      (u.businessName ?? "").toLowerCase().includes(q)
    );
  }, [units, search]);

  return (
    <>
      {/* Header con botón */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Unidades</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {units.length} unidad{units.length !== 1 ? "es" : ""} registrada{units.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva unidad
        </button>
      </div>

      {units.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, razón social, tipo, estado o centro de costos…"
            className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
      )}

      {/* Tabla */}
      {units.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Home className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">No hay unidades registradas</p>
          <p className="text-muted-foreground text-sm mb-5">
            Agrega apartamentos, oficinas o locales comerciales.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar primera unidad
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Razón social</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Piso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Área m²</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Coeficiente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Centro de costos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUnits.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Sin resultados para &quot;{search}&quot;.
                  </td>
                </tr>
              )}
              {filteredUnits.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/20 transition-colors group">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">{u.number}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell truncate max-w-[200px]">
                    {u.businessName || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {UNIT_TYPES.find(t => t.value === u.type)?.label ?? u.type}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.floor ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {u.areaMq ? `${u.areaMq} m²` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground hidden sm:table-cell">
                    {u.coefficient.toFixed(6)}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground hidden md:table-cell">
                    {u.costCenter || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[u.status] ?? "bg-secondary text-muted-foreground"}`}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Editar unidad"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={isPendingDelete && deletingId === u.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Eliminar unidad"
                      >
                        {isPendingDelete && deletingId === u.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet — formulario */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingUnit(null); }}>
        <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
          <div className="p-6 border-b border-border">
            <SheetHeader>
              <SheetTitle className="text-foreground">
                {isEditing ? "Editar Unidad" : "Nueva Unidad"}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground">
                {isEditing
                  ? "Actualiza los datos de esta unidad."
                  : "Registra un apartamento, oficina, local u otro tipo de unidad."}
              </SheetDescription>
            </SheetHeader>
          </div>

          <form
            key={editingUnit?.id ?? "create"}
            action={formAction}
            onSubmit={() => setSheetSubmitted(true)}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {sheetSubmitted && state?.error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                  {state.error}
                </div>
              )}

              <Field label="Número / Identificador *" htmlFor="number">
                <input
                  id="number" name="number" type="text" required
                  defaultValue={editingUnit?.number ?? ""}
                  placeholder="101, Local 3, Oficina 205…"
                  className={inputCls}
                />
              </Field>

              <Field label="Razón social" htmlFor="businessName">
                <input
                  id="businessName" name="businessName" type="text"
                  defaultValue={editingUnit?.businessName ?? ""}
                  placeholder="Ej. Agregados JC & Asociados S.A.S"
                  className={inputCls}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nombre de la empresa dueña o arrendataria, si aplica.
                </p>
              </Field>

              <Field label="Tipo *" htmlFor="type">
                <select id="type" name="type" defaultValue={editingUnit?.type ?? "apartment"} className={inputCls}>
                  {UNIT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Piso" htmlFor="floor">
                  <input
                    id="floor" name="floor" type="number" min={-5} max={200}
                    defaultValue={editingUnit?.floor ?? ""}
                    placeholder="1"
                    className={inputCls}
                  />
                </Field>
                <Field label="Área (m²)" htmlFor="area">
                  <input
                    id="area" name="area" type="text" inputMode="decimal"
                    defaultValue={editingUnit?.areaMq ?? ""}
                    placeholder="65.5 o 65,5"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Coeficiente de copropiedad *" htmlFor="coefficient">
                <input
                  id="coefficient" name="coefficient" type="text" inputMode="decimal"
                  required
                  defaultValue={editingUnit?.coefficient ?? ""}
                  placeholder="0.025000 o 0,025000"
                  className={inputCls}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Número entre 0 y 1 (puedes usar coma o punto decimal). Suma de todos los coeficientes debe ser 1.
                </p>
              </Field>

              <Field label="Centro de costos" htmlFor="costCenter">
                <input
                  id="costCenter" name="costCenter" type="text"
                  defaultValue={editingUnit?.costCenter ?? ""}
                  placeholder="Ej. 130501-3A"
                  className={inputCls}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Código contable independiente del número de la unidad — útil cuando un mismo propietario agrupa varias unidades.
                </p>
              </Field>

              <Field label="Estado" htmlFor="status">
                <select id="status" name="status" defaultValue={editingUnit?.status ?? "occupied"} className={inputCls}>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Botones sticky al fondo */}
            <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
              <button
                type="button"
                onClick={() => { setOpen(false); setEditingUnit(null); }}
                className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                  : isEditing ? "Guardar cambios" : "Guardar unidad"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

const inputCls = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
