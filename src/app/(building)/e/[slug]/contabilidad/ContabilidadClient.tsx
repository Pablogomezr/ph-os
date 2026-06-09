"use client";

import { useState, useMemo } from "react";
import {
  FileSpreadsheet, FileText, Download, TrendingUp,
  Receipt, Clock, CheckCircle2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n);
}

function getMonthRange() {
  const now  = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return { from: `${year}-${month}`, to: `${year}-${month}` };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type ContabilidadSummary = {
  totalCharged:   number;
  totalCollected: number;
  totalPending:   number;
  totalOverdue:   number;
  chargesCount:   number;
  paymentsCount:  number;
  collectionRate: number;
};

// ─── Botón de exportación ─────────────────────────────────────────────────────
function ExportButton({ label, sublabel, icon: Icon, color, bg, border, href }: {
  label: string; sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string; border: string; href: string;
}) {
  return (
    <a
      href={href}
      download
      className={`flex items-start gap-4 p-5 rounded-xl border ${border} ${bg} hover:opacity-90 transition-opacity group`}
    >
      <div className={`p-2.5 rounded-lg bg-white/10 shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${color}`}>{label}</p>
        <p className="text-xs text-white/60 mt-0.5">{sublabel}</p>
      </div>
      <Download className={`w-4 h-4 ${color} opacity-60 group-hover:opacity-100 shrink-0 mt-1`} />
    </a>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, accent, sub }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${accent}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ContabilidadClient({
  slug,
  summary,
}: {
  slug: string;
  summary: ContabilidadSummary;
}) {
  const defaultRange = getMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to,   setTo]   = useState(defaultRange.to);

  const baseUrl = useMemo(
    () => `/api/export/${slug}`,
    [slug]
  );

  function buildUrl(format: string) {
    return `${baseUrl}/${format}?from=${from}&to=${to}`;
  }

  const EXPORT_FORMATS = [
    {
      format:   "csv",
      label:    "Exportar CSV",
      sublabel: "Compatible con cualquier sistema contable",
      icon:     FileText,
      color:    "text-white",
      bg:       "bg-[#6366F1]",
      border:   "border-[#6366F1]/50",
    },
    {
      format:   "xlsx",
      label:    "Exportar Excel",
      sublabel: "Cargos y pagos en hojas separadas, con formato",
      icon:     FileSpreadsheet,
      color:    "text-white",
      bg:       "bg-[#10B981]",
      border:   "border-[#10B981]/50",
    },
    {
      format:   "siigo",
      label:    "Exportar Siigo",
      sublabel: "Formato TXT para importación en Siigo Nube",
      icon:     FileText,
      color:    "text-white",
      bg:       "bg-[#F59E0B]",
      border:   "border-[#F59E0B]/50",
    },
    {
      format:   "world-office",
      label:    "Exportar World Office",
      sublabel: "Formato de comprobantes pipe-delimitado",
      icon:     FileText,
      color:    "text-white",
      bg:       "bg-[#EF4444]",
      border:   "border-[#EF4444]/50",
    },
  ];

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contabilidad</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Exportación de movimientos a software contable colombiano
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Total facturado"
          value={formatCOP(summary.totalCharged)}
          sub={`${summary.chargesCount} cargos`}
          icon={Receipt}
          accent="bg-primary/10 text-primary"
        />
        <KPICard
          label="Recaudado"
          value={formatCOP(summary.totalCollected)}
          sub={`${summary.paymentsCount} pagos`}
          icon={CheckCircle2}
          accent="bg-[#10B981]/10 text-[#10B981]"
        />
        <KPICard
          label="Por cobrar"
          value={formatCOP(summary.totalPending)}
          sub="Saldo pendiente"
          icon={Clock}
          accent="bg-[#F59E0B]/10 text-[#F59E0B]"
        />
        <KPICard
          label="Tasa de recaudo"
          value={`${summary.collectionRate}%`}
          sub="Sobre total facturado"
          icon={TrendingUp}
          accent="bg-[#22D3EE]/10 text-[#22D3EE]"
        />
      </div>

      {/* Filtro de período */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Período de exportación</p>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Desde (mes)</label>
            <input
              type="month"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hasta (mes)</label>
            <input
              type="month"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="text-xs text-muted-foreground pb-2">
            Los archivos descargados incluirán todos los movimientos<br />
            registrados en el período seleccionado.
          </div>
        </div>
      </div>

      {/* Botones de exportación */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Descargar reporte</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPORT_FORMATS.map((f) => (
            <ExportButton
              key={f.format}
              label={f.label}
              sublabel={f.sublabel}
              icon={f.icon}
              color={f.color}
              bg={f.bg}
              border={f.border}
              href={buildUrl(f.format)}
            />
          ))}
        </div>
      </div>

      {/* Nota informativa */}
      <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-xl p-4">
        <p className="text-xs font-semibold text-[#22D3EE] mb-2">ℹ️ Cuentas contables utilizadas</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div><span className="font-mono text-foreground">130505</span> — Cartera residentes</div>
          <div><span className="font-mono text-foreground">420505</span> — Ingresos cuotas</div>
          <div><span className="font-mono text-foreground">111005</span> — Bancos / Caja</div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Puedes ajustar el catálogo contable en la configuración del edificio.
        </p>
      </div>
    </>
  );
}
