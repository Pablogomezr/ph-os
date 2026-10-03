import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { tieneAccesoPanel } from "@/lib/auth/helpers";
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
  if (!(await tieneAccesoPanel(slug, "contabilidad"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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

  // ─── CONCILIACIÓN — reporte completo en vivo (Finanzas → Conciliación) ────
  if (format === "conciliacion") {
    const [bankMovements, users] = await Promise.all([
      db.select().from(tenantSchema.bankMovements).orderBy(desc(tenantSchema.bankMovements.date)),
      db.select().from(tenantSchema.users),
    ]);

    // Residente principal por unidad (para "Top Deudores")
    const residentByUnit: Record<string, string> = {};
    for (const u of users) {
      let unitIds: string[] = [];
      try { unitIds = JSON.parse(u.unitIds || "[]"); } catch {}
      for (const uid of unitIds) {
        if (!residentByUnit[uid]) residentByUnit[uid] = u.name;
      }
    }
    const userNameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const paidByCharge: Record<string, number> = {};
    for (const p of paymentRows) {
      paidByCharge[p.chargeId] = (paidByCharge[p.chargeId] ?? 0) + p.amount;
    }

    // Unidad(es) aplicada(s) a cada movimiento bancario, vía el pago que lo conciliό
    const unitsByMovement: Record<string, Set<string>> = {};
    for (const p of paymentRows) {
      if (!p.matchedMovementId) continue;
      if (!unitsByMovement[p.matchedMovementId]) unitsByMovement[p.matchedMovementId] = new Set();
      unitsByMovement[p.matchedMovementId].add(unitMap[p.unitId] ?? "?");
    }

    const detalle = charges.map((c) => {
      const paid = paidByCharge[c.id] ?? 0;
      return {
        unidad: unitMap[c.unitId] ?? "?",
        concepto: c.specificConcept || (CONCEPT_LABELS[c.concept] ?? c.concept),
        cargado: c.amount,
        pagado: Math.min(paid, c.amount),
        saldo: Math.max(c.amount - paid, 0),
        estado: c.status,
      };
    });

    const byUnit: Record<string, { unidad: string; residente: string; cargado: number; pagado: number; saldo: number }> = {};
    for (const d of detalle) {
      if (!byUnit[d.unidad]) {
        const unitEntry = units.find((u) => u.number === d.unidad);
        byUnit[d.unidad] = {
          unidad: d.unidad,
          residente: unitEntry ? (residentByUnit[unitEntry.id] ?? "Sin registrar") : "?",
          cargado: 0, pagado: 0, saldo: 0,
        };
      }
      byUnit[d.unidad].cargado += d.cargado;
      byUnit[d.unidad].pagado += d.pagado;
      byUnit[d.unidad].saldo += d.saldo;
    }
    const topDeudores = Object.values(byUnit).sort((a, b) => b.saldo - a.saldo);

    const byConcepto: Record<string, { concepto: string; cargado: number; pagado: number; saldo: number }> = {};
    for (const d of detalle) {
      if (!byConcepto[d.concepto]) byConcepto[d.concepto] = { concepto: d.concepto, cargado: 0, pagado: 0, saldo: 0 };
      byConcepto[d.concepto].cargado += d.cargado;
      byConcepto[d.concepto].pagado += d.pagado;
      byConcepto[d.concepto].saldo += d.saldo;
    }
    const resumenConcepto = Object.values(byConcepto).sort((a, b) => b.saldo - a.saldo);

    const totalCargado = charges.reduce((s, c) => s + c.amount, 0);
    const totalPagado = paymentRows.reduce((s, p) => s + p.amount, 0);
    const totalPendiente = detalle.reduce((s, d) => s + d.saldo, 0);
    const pendientesConciliacion = paymentRows.filter((p) => p.bankStatus === "unverified");

    const wb = new ExcelJS.Workbook();
    wb.creator = "Propiedad Horizontal OS";
    wb.created = new Date();

    const headerStyle = (row: ExcelJS.Row, color: string) => {
      row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
      row.alignment = { horizontal: "center" };
    };

    // ── Resumen Ejecutivo
    const wsRes = wb.addWorksheet("Resumen Ejecutivo");
    wsRes.addRow(["REPORTE DE CONCILIACIÓN — " + slug]);
    wsRes.getRow(1).font = { bold: true, size: 14 };
    wsRes.addRow(["Generado: " + new Date().toLocaleString("es-CO")]);
    wsRes.addRow([]);
    wsRes.addRow(["Total cargado (histórico)", totalCargado]).getCell(2).numFmt = '"$"#,##0';
    wsRes.addRow(["Total pagado", totalPagado]).getCell(2).numFmt = '"$"#,##0';
    wsRes.addRow(["Total pendiente por cobrar", totalPendiente]).getCell(2).numFmt = '"$"#,##0';
    wsRes.addRow(["Tasa de cobranza", totalCargado > 0 ? `${Math.round((totalPagado / totalCargado) * 100)}%` : "—"]);
    wsRes.addRow([]);
    wsRes.addRow(["Movimientos bancarios importados", bankMovements.length]);
    wsRes.addRow(["Pagos pendientes de conciliación bancaria", pendientesConciliacion.length]);
    wsRes.addRow(["Pagos verificados contra el banco", paymentRows.filter((p) => p.bankStatus !== "unverified").length]);
    wsRes.getColumn(1).width = 40;
    wsRes.getColumn(2).width = 22;

    // ── Detalle por Unidad y Concepto
    const wsDet = wb.addWorksheet("Detalle por Unidad y Concepto");
    wsDet.columns = [
      { header: "Unidad", key: "unidad", width: 12 },
      { header: "Concepto", key: "concepto", width: 32 },
      { header: "Cargado", key: "cargado", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Pagado", key: "pagado", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Saldo Pendiente", key: "saldo", width: 18, style: { numFmt: '"$"#,##0' } },
      { header: "Estado", key: "estado", width: 14 },
    ];
    headerStyle(wsDet.getRow(1), "FF6366F1");
    detalle.forEach((d) => wsDet.addRow(d));
    wsDet.autoFilter = { from: "A1", to: `F${detalle.length + 1}` };

    // ── Resumen por Concepto
    const wsConc = wb.addWorksheet("Resumen por Concepto");
    wsConc.columns = [
      { header: "Concepto", key: "concepto", width: 30 },
      { header: "Cargado", key: "cargado", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Pagado", key: "pagado", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Saldo Pendiente", key: "saldo", width: 18, style: { numFmt: '"$"#,##0' } },
    ];
    headerStyle(wsConc.getRow(1), "FF6366F1");
    resumenConcepto.forEach((r) => wsConc.addRow(r));

    // ── Top Deudores
    const wsTop = wb.addWorksheet("Top Deudores");
    wsTop.columns = [
      { header: "Unidad", key: "unidad", width: 12 },
      { header: "Residente/Propietario", key: "residente", width: 32 },
      { header: "Cargado", key: "cargado", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Pagado", key: "pagado", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Saldo Pendiente", key: "saldo", width: 18, style: { numFmt: '"$"#,##0' } },
    ];
    headerStyle(wsTop.getRow(1), "FFEF4444");
    topDeudores.forEach((r) => wsTop.addRow(r));
    wsTop.autoFilter = { from: "A1", to: `E${topDeudores.length + 1}` };

    // ── Movimientos Bancarios Importados
    const wsBanco = wb.addWorksheet("Movimientos Bancarios");
    wsBanco.columns = [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Monto", key: "monto", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Referencia", key: "referencia", width: 20 },
      { header: "Descripción", key: "descripcion", width: 40 },
      { header: "Unidad Aplicada", key: "unidad", width: 18 },
      { header: "Estado", key: "estado", width: 16 },
    ];
    headerStyle(wsBanco.getRow(1), "FF10B981");
    bankMovements.forEach((m) => {
      const unitsMatched = unitsByMovement[m.id];
      wsBanco.addRow({
        fecha: formatDateStr(m.date), monto: m.amount, referencia: m.reference, descripcion: m.description,
        unidad: unitsMatched ? [...unitsMatched].join(", ") : "—",
        estado: unitsMatched ? "Aplicado a pago" : "Sin conciliar",
      });
    });

    // ── Pagos Pendientes de Conciliación
    const wsPend = wb.addWorksheet("Pendientes de Conciliación");
    wsPend.columns = [
      { header: "Unidad", key: "unidad", width: 12 },
      { header: "Reportado por", key: "reportadoPor", width: 28 },
      { header: "Teléfono", key: "telefono", width: 16 },
      { header: "Monto", key: "monto", width: 16, style: { numFmt: '"$"#,##0' } },
      { header: "Referencia", key: "referencia", width: 20 },
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Notas", key: "notas", width: 40 },
    ];
    headerStyle(wsPend.getRow(1), "FFF59E0B");
    pendientesConciliacion.forEach((p) => wsPend.addRow({
      unidad: unitMap[p.unitId] ?? "?",
      reportadoPor: p.reportedByUserId ? (userNameById[p.reportedByUserId] ?? "—") : "—",
      telefono: p.reportedByPhone ?? "—",
      monto: p.amount, referencia: p.reference ?? "",
      fecha: formatDateStr(p.createdAt), notas: p.notes ?? "",
    }));

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `conciliacion-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
}
