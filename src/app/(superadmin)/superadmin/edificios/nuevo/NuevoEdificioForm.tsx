"use client";

import { useActionState, useState, useEffect } from "react";
import { createBuilding, type CreateBuildingState } from "./actions";
import { Building2, Loader2 } from "lucide-react";

const MODULES = [
  { id: "finanzas",     label: "Finanzas",     desc: "Cargos, pagos y presupuesto" },
  { id: "energia",      label: "Energía",       desc: "Lecturas de medidores" },
  { id: "mantenimiento",label: "Mantenimiento", desc: "Activos y tareas" },
  { id: "pqrs",         label: "PQRS",          desc: "Peticiones y reclamos" },
  { id: "mensajeria",   label: "Mensajería",    desc: "Mensajes a residentes" },
  { id: "contabilidad", label: "Contabilidad",  desc: "Exportación contable" },
];

const PLANS = [
  { id: "base",         label: "Base",         desc: "Funciones esenciales" },
  { id: "professional", label: "Professional", desc: "Todo Base + módulos extra" },
  { id: "enterprise",   label: "Enterprise",   desc: "Sin límites" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function NuevoEdificioForm() {
  const [state, action, isPending] = useActionState<CreateBuildingState, FormData>(
    createBuilding,
    null
  );

  const [name, setName]         = useState("");
  const [slug, setSlug]         = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Auto-generar slug desde el nombre (si el usuario no lo ha editado)
  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(name));
    }
  }, [name, slugEdited]);

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <form action={action} className="space-y-8 max-w-2xl">
      {/* Error global */}
      {state?.error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      {/* ── Información básica ── */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Información básica
        </h2>

        {/* Nombre */}
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Nombre del edificio <span className="text-destructive">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Conjunto Residencial El Nogal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label htmlFor="slug" className="text-sm font-medium text-foreground">
            Slug (URL del edificio)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-2 rounded-l-lg border border-border border-r-0 whitespace-nowrap">
              /e/
            </span>
            <input
              id="slug"
              name="slug"
              type="text"
              placeholder="conjunto-el-nogal"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              className="flex-1 bg-input border border-border rounded-r-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Solo letras minúsculas, números y guiones. Se genera automáticamente desde el nombre.
          </p>
        </div>

        {/* Ciudad y Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="city" className="text-sm font-medium text-foreground">Ciudad</label>
            <input
              id="city"
              name="city"
              type="text"
              placeholder="Bogotá"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="nit" className="text-sm font-medium text-foreground">NIT</label>
            <input
              id="nit"
              name="nit"
              type="text"
              placeholder="900.123.456-7"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="address" className="text-sm font-medium text-foreground">Dirección</label>
          <input
            id="address"
            name="address"
            type="text"
            placeholder="Calle 93 # 19 - 55, Bogotá"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
      </section>

      {/* ── Plan ── */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Plan de suscripción
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <label
              key={p.id}
              className="relative flex flex-col gap-1 cursor-pointer p-4 rounded-lg border border-border hover:border-primary/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" name="plan" value={p.id} defaultChecked={p.id === "base"} className="sr-only" />
              <span className="text-sm font-semibold text-foreground">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.desc}</span>
            </label>
          ))}
        </div>
      </section>

      {/* ── Módulos ── */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Módulos activos
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            El módulo <strong>Base</strong> (unidades + residentes) siempre está incluido.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Base — siempre activo, no editable */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 opacity-70 cursor-not-allowed">
            <div className="w-4 h-4 rounded border-2 border-primary bg-primary flex items-center justify-center mt-0.5 shrink-0">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Base</p>
              <p className="text-xs text-muted-foreground">Unidades y residentes (siempre incluido)</p>
            </div>
          </div>

          {MODULES.map((mod) => (
            <label
              key={mod.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="checkbox"
                name="modules"
                value={mod.id}
                checked={selectedModules.includes(mod.id)}
                onChange={() => toggleModule(mod.id)}
                className="w-4 h-4 rounded accent-primary mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{mod.label}</p>
                <p className="text-xs text-muted-foreground">{mod.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between">
        <a
          href="/superadmin/edificios"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Cancelar
        </a>
        <button
          type="submit"
          disabled={isPending || !name}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creando edificio…
            </>
          ) : (
            <>
              <Building2 className="w-4 h-4" />
              Crear Edificio
            </>
          )}
        </button>
      </div>
    </form>
  );
}
