"use client";

import { useMemo, useState } from "react";
import { Search, FileText } from "lucide-react";
import type { ChargeWithUnit, Unit, ResidentUser } from "./types";

const CONCEPT_LABEL: Record<string, string> = {
  ordinary: "Cuota ordinaria de admin.", extraordinary: "Cuota extraordinaria",
  energy: "Cobro energía", water: "Agua / Acueducto", audit: "Auditoría", other: "Otros / retroactivos",
};

// Filtros por concepto (columna `concept`) + atajos de texto para sub-conceptos
// que viven dentro de la descripción de cada factura (Triple A, Auditoría, etc.).
const CONCEPT_FILTERS: { v: string; label: string }[] = [
  { v: "all",           label: "Todos" },
  { v: "ordinary",      label: "Administración" },
  { v: "extraordinary", label: "Extraordinaria" },
  { v: "energy",        label: "Energía" },
  { v: "other",         label: "Intereses / Otros" },
];
const TEXT_SHORTCUTS = [
  "Energía 1", "Energía 2", "Energía 3", "Energía 4", "Triple A", "Auditoría",
  "Retroactivo", "Áreas comunes", "Intereses",
];

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function formatDateShort(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function EstadoCuentaView({ units, charges, residents }: {
  units: Unit[];
  charges: ChargeWithUnit[];
  residents: ResidentUser[];
}) {
  const [search, setSearch] = useState("");
  const [conceptFilter, setConceptFilter] = useState("all");

  const q = norm(search.trim());
  const lineFilterActive = conceptFilter !== "all" || q !== "";

  // ¿Una factura pasa el filtro de concepto + texto (sobre concepto/descr/documento)?
  function lineMatches(c: ChargeWithUnit): boolean {
    if (conceptFilter !== "all" && c.concept !== conceptFilter) return false;
    if (!q) return true;
    const hay = norm(`${CONCEPT_LABEL[c.concept] ?? c.concept} ${c.specificConcept ?? ""} ${c.description ?? ""} ${c.reference ?? ""}`);
    return hay.includes(q);
  }
  // ¿El texto también puede referirse a la unidad o propietario? (búsqueda amplia)
  function unitTextMatches(unitNumber: string, ownerName: string): boolean {
    if (!q) return false;
    return norm(unitNumber).includes(q) || norm(ownerName).includes(q);
  }

  const blocks = useMemo(() => {
    return units
      .map((unit) => {
        const owners = residents.filter((r) => {
          try { return (JSON.parse(r.unitIds || "[]") as string[]).includes(unit.id); }
          catch { return false; }
        });
        const ownerName = owners.map((o) => o.name).join(" / ") || "Sin propietario asignado";

        const allCharges = charges
          .filter((c) => c.unitId === unit.id)
          .sort((a, b) => a.dueDate - b.dueDate);
        if (allCharges.length === 0) return null;

        // Si el texto coincide con la unidad/propietario, mostramos TODAS sus
        // líneas (que además cumplan el filtro de concepto). Si no, solo las
        // líneas que coincidan con el filtro de concepto+texto.
        const unitMatch = unitTextMatches(unit.number, ownerName);
        const shown = allCharges.filter((c) => {
          if (conceptFilter !== "all" && c.concept !== conceptFilter) return false;
          if (!q) return true;
          if (unitMatch) return true;
          return lineMatches(c);
        });
        if (shown.length === 0) return null;

        const total = shown.reduce((s, c) => s + (c.amount - c.paidAmount), 0);
        return { unit, owners, ownerName, unitCharges: shown, total };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [units, charges, residents, conceptFilter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const grandTotal = blocks.reduce((s, b) => s + b.total, 0);

  return (
    <div className="space-y-4">
      {/* Filtros por concepto */}
      <div className="flex flex-wrap gap-1 bg-secondary/40 p-1 rounded-lg w-fit">
        {CONCEPT_FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setConceptFilter(f.v)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              conceptFilter === f.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Buscador + atajos de sub-concepto */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por unidad, propietario, concepto o descripción (ej. Triple A, Auditoría, Energía)…"
          className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TEXT_SHORTCUTS.map((t) => (
          <button
            key={t}
            onClick={() => setSearch(t)}
            className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {t}
          </button>
        ))}
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs px-2.5 py-1 rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Resumen del filtro activo */}
      {lineFilterActive && blocks.length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            {blocks.length} unidad{blocks.length !== 1 ? "es" : ""} con saldo en este filtro
          </span>
          <span className="font-semibold text-foreground tabular-nums">Total filtrado: {formatCOP(grandTotal)}</span>
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">Sin resultados</p>
          <p className="text-muted-foreground text-sm">
            Ninguna unidad tiene facturas que coincidan con este filtro.
          </p>
        </div>
      ) : (
        blocks.map(({ unit, owners, ownerName, unitCharges, total }) => (
          <div key={unit.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Cabecera — imita el formato del Estado de Cuenta contable */}
            <div className="px-5 py-4 border-b border-border bg-secondary/20">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide underline">
                Ofc {unit.number}
              </p>
              <p className="text-base font-bold text-foreground mt-0.5">
                <span className="bg-[#F59E0B]/25 px-1 rounded">{unit.number}</span> {ownerName.toUpperCase()}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-xs text-muted-foreground mt-1.5">
                <span>Teléfono: {owners[0]?.phone || "—"}</span>
                <span>Email: {owners[0]?.email || "—"}</span>
              </div>
            </div>

            <p className="px-5 pt-3 pb-1 text-xs font-semibold text-primary italic">
              Cuentas por Cobrar{lineFilterActive ? " (filtrado)" : ""}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-muted-foreground border-b border-border">
                    <th className="px-5 py-1.5 font-semibold">Fecha</th>
                    <th className="px-5 py-1.5 font-semibold">Documento</th>
                    <th className="px-5 py-1.5 font-semibold">Concepto</th>
                    <th className="px-5 py-1.5 font-semibold hidden md:table-cell">Descripción</th>
                    <th className="px-5 py-1.5 font-semibold text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {unitCharges.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-1.5 text-xs text-foreground whitespace-nowrap">{formatDateShort(c.dueDate)}</td>
                      <td className="px-5 py-1.5 text-xs font-mono text-muted-foreground">{c.reference || "—"}</td>
                      <td className="px-5 py-1.5 text-xs text-foreground">
                        {CONCEPT_LABEL[c.concept] ?? c.concept}
                        {c.specificConcept && (
                          <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] whitespace-nowrap">
                            {c.specificConcept}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-1.5 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[280px]">
                        {c.description || "—"}
                      </td>
                      <td className="px-5 py-1.5 text-xs text-right font-mono text-foreground">
                        {formatCOP(c.amount - c.paidAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-2 border-t border-border flex items-center justify-between text-xs font-semibold text-foreground bg-secondary/10">
              <span>{lineFilterActive ? "Subtotal filtrado" : "Total para Cuentas por Cobrar"}</span>
              <span className="font-mono">{formatCOP(total)}</span>
            </div>
            {!lineFilterActive && (
              <div className="px-5 py-2.5 border-t border-border flex items-center justify-between text-sm font-bold text-primary bg-primary/5">
                <span>Total Consolidado {unit.number} {ownerName}</span>
                <span className="font-mono">{formatCOP(total)}</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
