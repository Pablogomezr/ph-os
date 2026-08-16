"use client";

import { useActionState, useState, useTransition, useEffect, useRef } from "react";
import {
  createOperador, deleteOperador, toggleOperadorActive,
  type OperadorFormState,
} from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  HardHat, Plus, Trash2, Loader2, Power, Smartphone, Copy, CheckCheck,
} from "lucide-react";

const inputCls =
  "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

type Operador = {
  id: string; name: string; email: string;
  phone: string | null; active: number; createdAt: number;
};

export default function OperadoresClient({
  slug, operadores,
}: {
  slug: string;
  operadores: Operador[];
}) {
  const [openSheet, setOpenSheet] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [isPendingDel, startDelTransition] = useTransition();
  const [isPendingTog, startTogTransition] = useTransition();

  const [state, formAction, isPending] =
    useActionState<OperadorFormState, FormData>(createOperador.bind(null, slug), null);

  const handledRef = useRef<OperadorFormState>(null);
  useEffect(() => {
    if (state?.success && state !== handledRef.current) {
      handledRef.current = state;
      setOpenSheet(false);
    }
  }, [state]);

  const portalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/op/${slug}/lecturas`
    : `/op/${slug}/lecturas`;

  async function copyLink() {
    await navigator.clipboard.writeText(portalUrl);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este operador?")) return;
    setDeletingId(id);
    startDelTransition(async () => {
      await deleteOperador(slug, id);
      setDeletingId(null);
    });
  }

  function handleToggle(id: string, current: number) {
    setTogglingId(id);
    startTogTransition(async () => {
      await toggleOperadorActive(slug, id, current === 0);
      setTogglingId(null);
    });
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operadores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {operadores.length} operador{operadores.length !== 1 ? "es" : ""} registrado{operadores.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOpenSheet(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo operador
        </button>
      </div>

      {/* Enlace del portal */}
      <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-[#22D3EE] uppercase tracking-wide flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> Portal Android del operador
        </p>
        <p className="text-xs text-muted-foreground">
          Comparte este enlace con tus operadores. Deben iniciar sesión con el email registrado abajo.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono truncate">
            {portalUrl}
          </code>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 bg-[#22D3EE]/10 hover:bg-[#22D3EE]/20 text-[#22D3EE] px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0"
          >
            {copiedSlug ? <><CheckCheck className="w-3.5 h-3.5"/>Copiado</> : <><Copy className="w-3.5 h-3.5"/>Copiar</>}
          </button>
        </div>
      </div>

      {/* Lista */}
      {operadores.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <HardHat className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">Sin operadores registrados</p>
          <p className="text-muted-foreground text-sm mb-5">
            Los operadores toman lecturas de medidores de energía desde su teléfono.
          </p>
          <button
            onClick={() => setOpenSheet(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Primer operador
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {operadores.map((op) => (
                <tr key={op.id} className="hover:bg-secondary/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <HardHat className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{op.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{op.email}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{op.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      op.active
                        ? "bg-[#10B981]/10 text-[#10B981]"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {op.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggle(op.id, op.active)}
                        disabled={isPendingTog && togglingId === op.id}
                        title={op.active ? "Desactivar" : "Activar"}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        {isPendingTog && togglingId === op.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(op.id)}
                        disabled={isPendingDel && deletingId === op.id}
                        title="Eliminar"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        {isPendingDel && deletingId === op.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet: nuevo operador */}
      <Sheet open={openSheet} onOpenChange={(v) => !v && setOpenSheet(false)}>
        <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
          <div className="p-6 border-b border-border">
            <SheetHeader>
              <SheetTitle className="text-foreground">Nuevo operador</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                El operador podrá tomar lecturas de energía desde su teléfono.
              </SheetDescription>
            </SheetHeader>
          </div>

          <form action={formAction} className="flex flex-col flex-1">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {state?.error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                  {state.error}
                </div>
              )}
              <Field label="Nombre completo *" htmlFor="name">
                <input id="name" name="name" type="text" required placeholder="Ej: Carlos Pérez" className={inputCls} />
              </Field>
              <Field label="Email (cuenta Google) *" htmlFor="email">
                <input id="email" name="email" type="email" required placeholder="operador@gmail.com" className={inputCls} />
              </Field>
              <Field label="Teléfono" htmlFor="phone">
                <input id="phone" name="phone" type="tel" placeholder="+57 300 0000000" className={inputCls} />
              </Field>
              <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">¿Cómo accede?</strong><br />
                El operador abre el portal en su teléfono, inicia sesión con Google usando este email y podrá registrar lecturas de todos los medidores.
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-border">
              <button type="button" onClick={() => setOpenSheet(false)}
                className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {isPending ? <><Loader2 className="w-4 h-4 animate-spin"/>Guardando…</> : "Crear operador"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
