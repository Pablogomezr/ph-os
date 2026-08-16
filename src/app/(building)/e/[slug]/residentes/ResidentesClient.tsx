"use client";

import { useActionState, useState, useTransition, useEffect, useRef, useMemo } from "react";
import { createResident, updateResident, deleteResident, toggleResidentActive, type ResidentFormState } from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, Trash2, Loader2, Users, ToggleLeft, ToggleRight, ExternalLink, Copy, Check, Pencil, Search,
} from "lucide-react";
import type { tenantSchema } from "@/lib/db/tenant";

type Resident = typeof tenantSchema.users.$inferSelect;
type Unit     = typeof tenantSchema.units.$inferSelect;

const ROLES = [
  { value: "resident",   label: "Propietario",    color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
  { value: "tenant",     label: "Arrendatario",   color: "text-[#A855F7]", bg: "bg-[#A855F7]/10" },
  // Observador: propietario que supervisa mientras otro gestiona la unidad.
  // Solo lectura — no radica PQRS ni reporta pagos por WhatsApp.
  { value: "observer",   label: "Observador",     color: "text-[#94A3B8]", bg: "bg-[#94A3B8]/10" },
  { value: "admin",      label: "Administrador",  color: "text-[#6366F1]", bg: "bg-[#6366F1]/10" },
  { value: "technician", label: "Técnico",        color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
];

const roleMap = Object.fromEntries(ROLES.map(r => [r.value, r]));

const typeLabel = (t: string) => t === "apartment" ? "Apto" : t === "commercial" ? "Garaje/Local" : "Oficina";

export default function ResidentesClient({
  slug,
  residents,
  units,
}: {
  slug: string;
  residents: Resident[];
  units: Unit[];
}) {
  const [open, setOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const [isPendingToggle, startToggleTransition] = useTransition();

  const unitById = useMemo(() => Object.fromEntries(units.map(u => [u.id, u.number])), [units]);

  const createResidentBound = createResident.bind(null, slug);
  const [createState, createFormAction, isCreating] = useActionState<ResidentFormState, FormData>(
    createResidentBound,
    null
  );

  const updateResidentBound = updateResident.bind(null, slug, editingResident?.id ?? "");
  const [updateState, updateFormAction, isUpdating] = useActionState<ResidentFormState, FormData>(
    updateResidentBound,
    null
  );

  const isEditing = editingResident !== null;
  const state = isEditing ? updateState : createState;
  const formAction = isEditing ? updateFormAction : createFormAction;
  const isPending = isEditing ? isUpdating : isCreating;

  const handledStateRef = useRef<ResidentFormState>(null);
  useEffect(() => {
    if (state?.success && state !== handledStateRef.current) {
      handledStateRef.current = state;
      setOpen(false);
      setEditingResident(null);
    }
  }, [state]);

  function handleOpenCreate() {
    setEditingResident(null);
    setUnitSearch("");
    setOpen(true);
  }

  function handleOpenEdit(r: Resident) {
    setEditingResident(r);
    setUnitSearch("");
    setOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    startDeleteTransition(async () => {
      await deleteResident(slug, id);
      setDeletingId(null);
    });
  }

  function handleToggle(id: string, currentActive: number) {
    setTogglingId(id);
    startToggleTransition(async () => {
      await toggleResidentActive(slug, id, !currentActive);
      setTogglingId(null);
    });
  }

  const [copied, setCopied] = useState(false);
  function handleCopyLink() {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const editingUnitIds: string[] = editingResident ? JSON.parse(editingResident.unitIds || "[]") : [];

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return units;
    return units.filter(u => u.number.toLowerCase().includes(q));
  }, [units, unitSearch]);

  const filteredResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter(r => {
      const unitIds: string[] = JSON.parse(r.unitIds || "[]");
      const unitNumbers = unitIds.map(id => unitById[id]).filter(Boolean);
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        unitNumbers.some(n => n.toLowerCase().includes(q))
      );
    });
  }, [residents, search, unitById]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Propietarios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {residents.length} persona{residents.length !== 1 ? "s" : ""} registrada{residents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo registro
        </button>
      </div>

      {/* Banner portal residentes */}
      <div className="flex items-center gap-3 bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-xl px-4 py-3 text-sm">
        <ExternalLink className="w-4 h-4 text-[#22D3EE] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#22D3EE]">Portal de residentes activo</p>
          <p className="text-xs text-muted-foreground truncate font-mono">/r/{slug}</p>
        </div>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-xs text-[#22D3EE] border border-[#22D3EE]/30 px-2.5 py-1.5 rounded-lg hover:bg-[#22D3EE]/10 transition-colors shrink-0"
        >
          {copied ? <><Check className="w-3 h-3" />¡Copiado!</> : <><Copy className="w-3 h-3" />Copiar enlace</>}
        </button>
      </div>

      {residents.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono o unidad…"
            className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
      )}

      {residents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">No hay propietarios registrados</p>
          <p className="text-muted-foreground text-sm mb-5">
            Registra propietarios, arrendatarios y personal del edificio.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Registrar primero
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Unidades</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredResidents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Sin resultados para &quot;{search}&quot;.
                  </td>
                </tr>
              )}
              {filteredResidents.map((r) => {
                const role = roleMap[r.role] ?? roleMap.resident;
                const unitIds: string[] = JSON.parse(r.unitIds || "[]");
                const unitNumbers = unitIds.map(id => unitById[id]).filter(Boolean);
                return (
                  <tr key={r.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.name}</p>
                      {r.phone && <p className="text-xs text-muted-foreground">{r.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role.bg} ${role.color}`}>
                        {role.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {unitNumbers.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {unitNumbers.slice(0, 4).map(n => (
                            <span key={n} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground">{n}</span>
                          ))}
                          {unitNumbers.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{unitNumbers.length - 4}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.active ? "bg-[#10B981]/10 text-[#10B981]" : "bg-secondary text-muted-foreground"
                      }`}>
                        {r.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggle(r.id, r.active)}
                          disabled={isPendingToggle && togglingId === r.id}
                          title={r.active ? "Desactivar" : "Activar"}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          {isPendingToggle && togglingId === r.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : r.active
                            ? <ToggleRight className="w-3.5 h-3.5" />
                            : <ToggleLeft className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={isPendingDelete && deletingId === r.id}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {isPendingDelete && deletingId === r.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet — formulario (crear / editar) */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingResident(null); }}>
        <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
          <div className="p-6 border-b border-border">
            <SheetHeader>
              <SheetTitle className="text-foreground">{isEditing ? "Editar registro" : "Nuevo registro"}</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                {isEditing
                  ? "Actualiza los datos y las unidades asignadas."
                  : "Registra propietarios, arrendatarios o personal del edificio."}
              </SheetDescription>
            </SheetHeader>
          </div>

          <form key={editingResident?.id ?? "create"} action={formAction} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {state?.error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                  {state.error}
                </div>
              )}

              <Field label="Nombre completo *" htmlFor="name">
                <input
                  id="name" name="name" type="text" required
                  defaultValue={editingResident?.name ?? ""}
                  placeholder="María Fernanda López"
                  className={inputCls}
                />
              </Field>

              <Field label="Email *" htmlFor="email">
                <input
                  id="email" name="email" type="email" required
                  defaultValue={editingResident?.email ?? ""}
                  placeholder="mflopez@gmail.com"
                  className={inputCls}
                />
              </Field>

              <Field label="Teléfono" htmlFor="phone">
                <input
                  id="phone" name="phone" type="tel"
                  defaultValue={editingResident?.phone ?? ""}
                  placeholder="+57 310 123 4567"
                  className={inputCls}
                />
              </Field>

              <Field label="Rol *" htmlFor="role">
                <select id="role" name="role" defaultValue={editingResident?.role ?? "resident"} className={inputCls}>
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>

              {units.length > 0 && (
                <Field label="Unidades asignadas" htmlFor="unitIds">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)}
                        placeholder="Buscar unidad…"
                        className="w-full bg-input border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                      {filteredUnits.map(u => (
                        <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/40 cursor-pointer">
                          <input
                            type="checkbox" name="unitIds" value={u.id}
                            defaultChecked={editingUnitIds.includes(u.id)}
                            className="rounded border-border"
                          />
                          <span className="font-mono text-foreground">{u.number}</span>
                          <span className="text-xs text-muted-foreground">{typeLabel(u.type)}</span>
                        </label>
                      ))}
                      {filteredUnits.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin resultados.</p>
                      )}
                    </div>
                  </div>
                </Field>
              )}
            </div>

            {/* Botones sticky al fondo */}
            <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
              <button
                type="button"
                onClick={() => { setOpen(false); setEditingResident(null); }}
                className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : "Guardar"}
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
