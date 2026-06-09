import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc, and, gte, lte } from "drizzle-orm";
import ExcelJS from "exceljs";

type Params = { slug: string; format: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateStr(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).replace(/\//g, "/");
}
function formatDateSiigo(ts: number) {
  // Siigo usa YYYYMMDD
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}

const CONCEPT_LABELS: Record<string, string> = {
  admin_fee: "Cuota de administración",
  parking:   "Parqueadero",
  water:     "Agua",
  gas:       "Gas",
  internet:  "Internet",
  energy:    "Energía",
  penalty:   "Multa/Sanción",
  other:     "Otro",
};

// ─── GET /api/export/[slug]/[format]?from=YYYY-MM&to=YYYY-MM ─────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, format } = await params;
  const searchParams = req.nextUrl.searchParams;

  // Rango de fechas (por mes: YYYY-MM)
  const fromParam = searchParams.get("from"); // ej: "2026-01"
  const toParam   = searchParams.get("to");   // ej: "2026-06"

  let fromTs: number | undefined;
  let toTs:   number | undefined;

  if (fromParam) {
    fromTs = Math.floor(new Date(`${fromParam}-01T00:00:00`).getTime() / 1000);
  }
  if (toParam) {
    // Último día del mes
    const [y, m] = toParam.split("-").map(Number);
    const lastDay = new Date(y, m, 0); // día 0 del mes siguiente = último del mes actual
    toTs = Math.floor(lastDay.setHours(23, 59, 59, 999) / 1000);
  }

  const db = await getTenantDb(slug);

  // Fetch charges
  const chargeFilter = [];
  if (fromTs) chargeFilter.push(gte(tenantSchema.charges.createdAt, fromTs));
  if (toTs)   chargeFilter.push(lte(tenantSchema.charges.createdAt, toTs));

  const [charges, units, paymentRows] = await Promise.all([
    db.select().from(tenantSchema.charges)
      .where(chargeFilter.length ? and(...chargeFilter) : undefined)
      .orderBy(desc(tenantSchema.charges.createdAt)),
    db.select().from(tenantSchema.units),
    db.select().from(tenantSchema.payments)
      .orderBy(desc(tenantSchema.payments.createdAt)),
  ]);

  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.number]));

  // Filtrar pagos por rango si aplica
  const payments = paymentRows.filter((p) => {
    if (fromTs && p.createdAt < fromTs) return false;
    if (toTs   && p.createdAt > toTs)   return false;
    return true;
  });

  const chargeMap = Object.fromEntries(charges.map((c) => [c.id, c]));

  // ─── Estructuras normalizadas ─────────────────────────────────────────────
  const chargeRows = charges.map((c) => ({
    unidad:     unitMap[c.unitId] ?? "?",
    concepto:   CONCEPT_LABELS[c.concept] ?? c.concept,
    descripcion: c.description ?? "",
    monto:      c.amount,
    vencimiento: formatDateStr(c.dueDate),
    estado:     c.status,
    creado:     formatDateStr(c.createdAt),
    lote:       c.batchId ?? "",
  }));

  const paymentRowsNorm = payments.map((p) => {
    const charge = chargeMap[p.chargeId];
    return {
      unidad:    charge ? (unitMap[charge.unitId] ?? "?") : "?",
      concepto:  charge ? (CONCEPT_LABELS[charge.concept] ?? charge.concept) : "?",
      monto:     p.amount,
      metodo:    p.method ?? "efectivo",
      referencia: p.reference ?? "",
      fecha:     formatDateStr(p.createdAt),
      notas:     p.notes ?? "",
    };
  });

  // ─── CSV ──────────────────────────────────────────────────────────────────
  if (format === "csv") {
    const lines: string[] = [];

    lines.push("=== CARGOS ===");
    lines.push("Unidad;Concepto;Descripción;Monto;Vencimiento;Estado;Creado;Lote");
    chargeRows.forEach((r) =>
      lines.push(`${r.unidad};${r.concepto};${r.descripcion};${r.monto};${r.vencimiento};${r.estado};${r.creado};${r.lote}`)
    );
    lines.push("");
    lines.push("=== PAGOS ===");
    lines.push("Unidad;Concepto;Monto;Método;Referencia;Fecha;Notas");
    paymentRowsNorm.forEach((r) =>
      lines.push(`${r.unidad};${r.concepto};${r.monto};${r.metodo};${r.referencia};${r.fecha};${r.notas}`)
    );

    const csv = lines.join("\r\n");
    const filename = `contabilidad-${slug}-${new Date().toISOString().slice(0,10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ─── EXCEL (.xlsx) ───────────────────────────────────────────────────────
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Propiedad Horizontal OS";
    wb.created = new Date();

    // ── Hoja Cargos
    const wsCargos = wb.addWorksheet("Cargos");
    wsCargos.columns = [
      { header: "Unidad",      key: "unidad",      width: 12 },
      { header: "Concepto",    key: "concepto",    width: 28 },
      { header: "Descripción", key: "descripcion", width: 35 },
      { header: "Monto",       key: "monto",       width: 14, style: { numFmt: '"$"#,##0' } },
      { header: "Vencimiento", key: "vencimiento", width: 14 },
      { header: "Estado",      key: "estado",      width: 12 },
      { header: "Creado",      key: "creado",      width: 14 },
    ];
    const headerRowC = wsCargos.getRow(1);
    headerRowC.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRowC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } };
    headerRowC.alignment = { horizontal: "center" };
    chargeRows.forEach((r) => wsCargos.addRow(r));
    wsCargos.autoFilter = { from: "A1", to: `G${chargeRows.length + 1}` };

    // ── Hoja Pagos
    const wsPagos = wb.addWorksheet("Pagos");
    wsPagos.columns = [
      { header: "Unidad",     key: "unidad",     width: 12 },
      { header: "Concepto",   key: "concepto",   width: 28 },
      { header: "Monto",      key: "monto",      width: 14, style: { numFmt: '"$"#,##0' } },
      { header: "Método",     key: "metodo",     width: 14 },
      { header: "Referencia", key: "referencia", width: 20 },
      { header: "Fecha",      key: "fecha",      width: 14 },
      { header: "Notas",      key: "notas",      width: 30 },
    ];
    const headerRowP = wsPagos.getRow(1);
    headerRowP.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRowP.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B981" } };
    headerRowP.alignment = { horizontal: "center" };
    paymentRowsNorm.forEach((r) => wsPagos.addRow(r));

    // ── Hoja Resumen
    const wsRes = wb.addWorksheet("Resumen");
    wsRes.addRow(["RESUMEN CONTABLE"]);
    wsRes.getRow(1).font = { bold: true, size: 14 };
    wsRes.addRow([]);
    wsRes.addRow(["Edificio",       slug]);
    wsRes.addRow(["Fecha exportación", new Date().toLocaleDateString("es-CO")]);
    wsRes.addRow([]);
    wsRes.addRow(["Total cargos",   charges.length]);
    wsRes.addRow(["Total facturado", charges.reduce((s,c) => s + c.amount, 0)]);
    wsRes.addRow(["Total pagos",    payments.length]);
    wsRes.addRow(["Total recaudado", payments.reduce((s,p) => s + p.amount, 0)]);
    wsRes.getColumn(1).width = 22;
    wsRes.getColumn(2).width = 20;

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `contabilidad-${slug}-${new Date().toISOString().slice(0,10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ─── SIIGO TXT ────────────────────────────────────────────────────────────
  // Formato Siigo Nube — comprobante de diario
  // Cuenta 1305 = Deudores comerciales / clientes copropiedad
  if (format === "siigo") {
    const lines: string[] = [];
    // Encabezado Siigo
    lines.push("NroDoc;TipoDoc;Fecha;NitTercero;NombreTercero;CuentaDB;CuentaCR;Valor;Descripcion;CentCosto");

    charges.forEach((c) => {
      const unit = unitMap[c.unitId] ?? "000";
      const nitTercero = `900000${unit.padStart(3,"0")}`; // NIT ficticio por unidad
      const nombre = `Unidad ${unit}`;
      const fecha = formatDateSiigo(c.createdAt);
      const concepto = CONCEPT_LABELS[c.concept] ?? c.concept;
      const desc = `${concepto}${c.description ? " - " + c.description : ""}`.slice(0, 60);

      // Débito: 1305xx (cartera copropiedad)
      // Crédito: 4205xx (ingresos por cuotas)
      lines.push([
        c.id.slice(0,8),   // NroDoc
        "FC",              // TipoDoc = Factura de cobro
        fecha,
        nitTercero,
        nombre,
        "130505",          // Cuenta DB — Deudores residentes
        "420505",          // Cuenta CR — Ingresos cuotas
        c.amount,
        desc,
        "001",             // Centro de costo
      ].join(";"));
    });

    payments.forEach((p) => {
      const charge = chargeMap[p.chargeId];
      const unit = charge ? (unitMap[charge.unitId] ?? "000") : "000";
      const nitTercero = `900000${unit.padStart(3,"0")}`;
      const nombre = `Unidad ${unit}`;
      const fecha = formatDateSiigo(p.createdAt);
      const concepto = charge ? (CONCEPT_LABELS[charge.concept] ?? charge.concept) : "Pago";
      const desc = `Pago ${concepto}${p.reference ? " Ref:" + p.reference : ""}`.slice(0,60);

      // Débito: 1110 (caja/bancos) / Crédito: 1305 (cartera)
      lines.push([
        p.id.slice(0,8),
        "RC",              // TipoDoc = Recibo de caja
        fecha,
        nitTercero,
        nombre,
        "111005",          // Cuenta DB — Bancos
        "130505",          // Cuenta CR — Cartera
        p.amount,
        desc,
        "001",
      ].join(";"));
    });

    const txt = lines.join("\r\n");
    const filename = `siigo-${slug}-${new Date().toISOString().slice(0,10)}.txt`;

    return new NextResponse(txt, {
      headers: {
        "Content-Type":        "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ─── WORLD OFFICE TXT ─────────────────────────────────────────────────────
  if (format === "world-office") {
    const lines: string[] = [];
    // Formato World Office: campo fijo pipe-delimitado
    lines.push("TIPO|CUENTA|NOMBRE|DESCRIPCION|FECHA|DEBITO|CREDITO|REFERENCIA|CENTROCOSTO");

    charges.forEach((c) => {
      const unit  = unitMap[c.unitId] ?? "000";
      const fecha = new Date(c.createdAt * 1000).toLocaleDateString("es-CO");
      const concepto = CONCEPT_LABELS[c.concept] ?? c.concept;
      const desc = `${concepto} Unidad ${unit}`.slice(0, 50);

      lines.push([
        "DC",              // Débito-Crédito
        "130505",          // Cuenta cartera
        `Unidad ${unit}`,
        desc,
        fecha,
        c.amount,          // Débito
        0,                 // Crédito
        c.id.slice(0,10),
        "001",
      ].join("|"));

      lines.push([
        "DC",
        "420505",           // Ingresos
        `Unidad ${unit}`,
        desc,
        fecha,
        0,
        c.amount,
        c.id.slice(0,10),
        "001",
      ].join("|"));
    });

    payments.forEach((p) => {
      const charge = chargeMap[p.chargeId];
      const unit   = charge ? (unitMap[charge.unitId] ?? "000") : "000";
      const fecha  = new Date(p.createdAt * 1000).toLocaleDateString("es-CO");
      const desc   = `Pago Unidad ${unit}${p.reference ? " " + p.reference : ""}`.slice(0,50);

      lines.push([
        "DC", "111005", `Unidad ${unit}`, desc, fecha, p.amount, 0, p.id.slice(0,10), "001",
      ].join("|"));
      lines.push([
        "DC", "130505", `Unidad ${unit}`, desc, fecha, 0, p.amount, p.id.slice(0,10), "001",
      ].join("|"));
    });

    const txt = lines.join("\r\n");
    const filename = `world-office-${slug}-${new Date().toISOString().slice(0,10)}.txt`;

    return new NextResponse(txt, {
      headers: {
        "Content-Type":        "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
}
