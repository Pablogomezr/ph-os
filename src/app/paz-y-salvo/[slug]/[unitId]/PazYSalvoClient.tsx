"use client";

import { useEffect } from "react";

interface Building {
  name: string;
  nit: string | null;
  address: string | null;
  city: string | null;
}

interface UnitInfo {
  id: string;
  number: string;
  type: string;
  floor: number | null;
}

interface ConceptSummary {
  key: string;
  label: string;
  charged: number;
  paid: number;
  balance: number;
}

interface Props {
  building: Building;
  unit: UnitInfo;
  ownerName: string | null;
  hasDebt: boolean;
  concepts: ConceptSummary[];
  issuedAt: number;
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PazYSalvoClient({
  building,
  unit,
  ownerName,
  hasDebt,
  concepts,
  issuedAt,
}: Props) {
  const unitTypeLabel =
    unit.type === "apartment"
      ? "Apartamento"
      : unit.type === "office"
      ? "Oficina"
      : "Local";

  // Auto-print when loaded as paz y salvo (only if al día)
  useEffect(() => {
    if (!hasDebt) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [hasDebt]);

  if (hasDebt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Paz y Salvo no disponible</h1>
          <p className="text-gray-600 text-sm">
            La unidad <strong>{unit.number}</strong> tiene saldo pendiente de pago.
            El certificado de Paz y Salvo solo puede generarse cuando todos los cargos
            estén cancelados en su totalidad.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-left space-y-1.5">
            {concepts.filter((c) => c.balance > 0.01).map((c) => (
              <div key={c.key} className="flex justify-between text-sm">
                <span className="text-gray-700">{c.label}</span>
                <span className="font-semibold text-red-600">{formatCOP(c.balance)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => window.close()}
            className="mt-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const totalCharged = concepts.reduce((s, c) => s + c.charged, 0);

  return (
    <>
      {/* Barra de acciones — se oculta al imprimir */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <span className="text-sm text-gray-600 font-medium">
          Vista previa del Certificado de Paz y Salvo
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => window.close()}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Certificado */}
      <div className="min-h-screen bg-gray-100 print:bg-white py-16 print:py-0 flex items-start justify-center">
        <div
          className="bg-white w-[210mm] min-h-[297mm] shadow-xl print:shadow-none mx-auto p-12 print:p-10"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        >
          {/* Encabezado */}
          <div className="border-b-2 border-gray-800 pb-6 mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {building.name}
                </h1>
                {building.nit && (
                  <p className="text-sm text-gray-600 mt-0.5">NIT: {building.nit}</p>
                )}
                {(building.address || building.city) && (
                  <p className="text-sm text-gray-600">
                    {[building.address, building.city].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Al día
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Expedido: {formatDate(issuedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 tracking-wide uppercase letter-spacing-widest">
              Certificado de Paz y Salvo
            </h2>
            <p className="text-sm text-gray-500 mt-2 uppercase tracking-widest">
              Administración de Propiedades
            </p>
          </div>

          {/* Cuerpo principal */}
          <div className="space-y-6 text-gray-800 leading-relaxed">
            <p className="text-base text-justify">
              La administración de{" "}
              <strong className="text-gray-900">{building.name}</strong>
              {building.city ? `, ubicado en la ciudad de ${building.city},` : ","}{" "}
              certifica que:
            </p>

            {/* Datos de la unidad */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">
                    {unitTypeLabel}
                  </p>
                  <p className="text-lg font-bold text-gray-900">{unit.number}</p>
                </div>
                {unit.floor != null && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">
                      Piso
                    </p>
                    <p className="text-lg font-bold text-gray-900">{unit.floor}</p>
                  </div>
                )}
                {ownerName && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">
                      Propietario / Ocupante
                    </p>
                    <p className="text-base font-semibold text-gray-900">{ownerName}</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-base text-justify">
              …<strong>SE ENCUENTRA AL DÍA</strong> con todas sus obligaciones de
              administración y pago de cuotas ante la copropiedad, a la fecha de
              expedición del presente certificado.
            </p>

            {/* Desglose de conceptos */}
            {concepts.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Detalle de conceptos verificados:
                </p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2 text-gray-600 font-semibold">Concepto</th>
                      <th className="text-right py-2 text-gray-600 font-semibold">Cargo total</th>
                      <th className="text-right py-2 text-gray-600 font-semibold">Pagado</th>
                      <th className="text-right py-2 text-gray-600 font-semibold">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {concepts.map((c) => (
                      <tr key={c.key}>
                        <td className="py-2 text-gray-800">{c.label}</td>
                        <td className="py-2 text-right text-gray-700 tabular-nums">{formatCOP(c.charged)}</td>
                        <td className="py-2 text-right text-green-700 tabular-nums font-medium">{formatCOP(c.paid)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-green-700">
                          {formatCOP(c.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td className="py-2 font-bold text-gray-900">Total</td>
                      <td className="py-2 text-right font-bold text-gray-900 tabular-nums">{formatCOP(totalCharged)}</td>
                      <td className="py-2 text-right font-bold text-green-700 tabular-nums">{formatCOP(totalCharged)}</td>
                      <td className="py-2 text-right font-bold text-green-700 tabular-nums">$0</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <p className="text-base text-justify">
              Este certificado es válido únicamente para la fecha de expedición indicada.
              Cualquier cargo generado con posterioridad a esta fecha no se encuentra
              cubierto por el presente documento.
            </p>
          </div>

          {/* Sección de firmas */}
          <div className="mt-14 pt-8 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-16">
              <div className="text-center">
                <div className="border-b border-gray-400 mb-2 pb-8" />
                <p className="text-sm font-semibold text-gray-700">Administrador(a)</p>
                <p className="text-xs text-gray-500">{building.name}</p>
              </div>
              <div className="text-center">
                <div className="border-b border-gray-400 mb-2 pb-8" />
                <p className="text-sm font-semibold text-gray-700">Sello / Firma Revisor Fiscal</p>
                <p className="text-xs text-gray-500">Opcional</p>
              </div>
            </div>
          </div>

          {/* Pie de página */}
          <div className="mt-10 pt-4 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400">
              Documento generado automáticamente por el sistema de administración ·{" "}
              {formatDate(issuedAt)} · {building.name}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
