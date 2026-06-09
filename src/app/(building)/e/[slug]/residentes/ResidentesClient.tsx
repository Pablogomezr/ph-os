"use client";

import { useActionState, useState, useTransition, useEffect, useRef } from "react";
import { createResident, deleteResident, toggleResidentActive, type ResidentFormState } from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Plus, Trash2, Loader2, Users, ToggleLeft, ToggleRight, ExternalLink, Copy, Check } from "lucide-react";
import type { tenantSchema } from "@/lib/db/tenant";

type Resident = typeof tenantSchema.users.$inferSelect;
type Unit     = typeof tenantSchema.units.$inferSelect;

const ROLES = [
  { value: "resident",   label: "Residente",     color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
  { value: "admin",      label: "Administrador",  color: "text-[#6366F1]", bg: "bg-[#6366F1]/10" },
  { value: "technician", label: "Técnico",        color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
];

const roleMap = Object.fromEntries(ROLES.map(r => [r.value, r]));

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const [isPendingToggle, startToggleTransition] = useTransition();

  const createResidentBound = createResident.bind(null, slug);
  const [state, formAction, isPending] = useActionState<ResidentFormState, FormData>(
    createResidentBound,
    null
  );

  const handledStateRef = useRef<ResidentFormState>(null);
  useEffect(() => {
    if (state?.success && state !== handledStateRef.current) {
      handledStateRef.current = state;
      setOpen(false);
    }
  }, [state]);

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este residente? Esta acción no se puede deshacer.")) return;
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
  const portalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/r/${slug}`
    : `/r/${slug}`;

  function handleCopyLink() {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Residentes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {residents.length} persona{residents.length !== 1 ? "s" : ""} registrada{residents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo residente
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

      {residents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">No hay residentes registrados</p>
          <p className="text-muted-foreground text-sm mb-5">
            Registra propietarios, residentes y personal del edificio.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Registrar primer residente
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {residents.map((r) => {
                const role = roleMap[r.role] ?? roleMap.resident;
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

      {/* Sheet — formulario */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
          <div className="p-6 border-b border-border">
            <SheetHeader>
              <SheetTitle className="text-foreground">Nuevo Residente</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                Registra propietarios, arrendatarios o personal del edificio.
              </SheetDescription>
            </SheetHeader>
          </div>

          <form action={formAction} className="flex flex-col flex-1 min-h-0"><div className="flex-1 overflow-y-auto p-6 space-y-4">
            {state?.error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                {state.error}
              </div>
            )}

            <Field label="Nombre completo *" htmlFor="name">
              <input
                id="name" name="name" type="text" required
                placeholder="María Fernanda López"
                className={inputCls}
              />
            </Field>

            <Field label="Email *" htmlFor="email">
              <input
                id="email" name="email" type="email" required
                placeholder="mflopez@gmail.com"
                className={inputCls}
              />
            </Field>

            <Field label="Teléfono" htmlFor="phone">
              <input
                id="phone" name="phone" type="tel"
                placeholder="+57 310 123 4567"
                className={inputCls}
              />
            </Field>

            <Field label="Rol *" htmlFor="role">
              <select id="role" name="role" defaultValue="resident" className={inputCls}>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>

            {units.length > 0 && (
              <Field label="Unidad asignada" htmlFor="unitId">
                <select id="unitId" name="unitId" className={inputCls}>
                  <option value="">Sin asignar</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.number} — {u.type === "apartment" ? "Apto" : u.type === "office" ? "Oficina" : "Local"}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            </div>

            {/* Botones sticky al fondo */}
            <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : "Guardar residente"}
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
