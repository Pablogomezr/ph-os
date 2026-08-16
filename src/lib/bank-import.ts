import "server-only";
import ExcelJS from "exceljs";

// pdf-parse (vía pdfjs-dist) referencia DOMMatrix — una API de navegador — para
// rutas de renderizado que no usamos aquí (solo extraemos texto). En el
// runtime serverless de Vercel no existe y el paquete opcional que la
// proveería (@napi-rs/canvas) no está instalado, así que sin este polyfill
// mínimo la importación de PDF revienta con "DOMMatrix is not defined".
// Debe aplicarse ANTES de cargar pdf-parse — por eso el import es dinámico
// más abajo (un import estático se evaluaría antes que este polyfill).
if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === "undefined") {
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = class DOMMatrix {};
}

export type ParsedMovement = {
  date: number;       // unix seconds
  amount: number;
  reference: string;
  description: string;
};

const COL_FECHA = ["fecha", "date"];
const COL_MONTO = [
  "crédito", "credito", "abono", "valor crédito", "valor credito",
  "monto", "valor",
];
const COL_REFERENCIA = [
  "referencia", "no. transacción", "no transaccion",
  "número de referencia", "numero de referencia",
  "transacción", "transaccion", "ref", "no. cheque / ref",
];
const COL_DESCRIPCION = [
  "descripción", "descripcion", "concepto", "detalle",
  "descripción transacción", "descripcion transaccion",
];

function normalizeAmount(raw: string): number {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "nan") return 0;
  let s = trimmed.replace(/\$/g, "").replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    s = parts.length === 2 && parts[1].length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length > 2)) {
      s = s.replace(/\./g, "");
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(raw: string): number {
  const s = (raw ?? "").trim().slice(0, 10);
  // YYYY-MM-DD
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1000);
  // YYYYMMDD (sin separadores — extracto CSV plano de Bancolombia)
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1000);
  // DD/MM/YYYY o DD-MM-YYYY
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (m) return Math.floor(new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() / 1000);
  // DD/MM/YY
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/.exec(s);
  if (m) return Math.floor(new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() / 1000);
  return Math.floor(Date.now() / 1000);
}

function findColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) return idx;
  }
  return -1;
}

function rowsFromCells(cellsPerRow: string[][]): ParsedMovement[] {
  // Buscar la fila de encabezado — la primera que contenga "fecha"
  const headerRowIdx = cellsPerRow.findIndex((row) =>
    row.some((c) => c.trim().toLowerCase().includes("fecha"))
  );
  if (headerRowIdx === -1) {
    throw new Error(
      "No se encontró la fila de encabezados (debe contener una columna 'Fecha'). " +
      "Verifica que sea el extracto exportado directamente del banco."
    );
  }

  const headers = cellsPerRow[headerRowIdx];
  const idxFecha = findColumn(headers, COL_FECHA);
  const idxMonto = findColumn(headers, COL_MONTO);
  const idxRef = findColumn(headers, COL_REFERENCIA);
  const idxDesc = findColumn(headers, COL_DESCRIPCION);

  const faltantes = [
    ["Fecha", idxFecha], ["Monto/Crédito", idxMonto],
    ["Referencia", idxRef], ["Descripción", idxDesc],
  ].filter(([, idx]) => idx === -1).map(([name]) => name);

  if (faltantes.length > 0) {
    throw new Error(
      `No se encontraron las columnas: ${faltantes.join(", ")}. ` +
      `Columnas detectadas: ${headers.filter(Boolean).join(", ")}`
    );
  }

  const dataRows = cellsPerRow.slice(headerRowIdx + 1).filter((row) => row.some((c) => c.trim() !== ""));

  const movements: ParsedMovement[] = dataRows
    .map((row) => ({
      date: normalizeDate(row[idxFecha] ?? ""),
      amount: normalizeAmount(row[idxMonto] ?? ""),
      reference: (row[idxRef] ?? "").trim(),
      description: (row[idxDesc] ?? "").trim(),
    }))
    .filter((m) => m.amount > 0); // solo créditos/abonos — igual que el importador anterior

  return movements;
}

function parseCsv(text: string): string[][] {
  const delimiter = text.includes(";") && !text.includes(",") ? ";" : ",";
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(delimiter).map((cell) => cell.replace(/^"|"$/g, "").trim()));
}

/**
 * Bancolombia también exporta un CSV "plano" sin fila de encabezado, con
 * columnas fijas por posición (Sucursal Virtual → Extractos → Descargar CSV):
 *   0: cuenta | 1: código | 2: (vacío) | 3: fecha YYYYMMDD | 4: referencia
 *   5: monto (negativo = débito) | 6: código | 7: descripción | 8: flag | 9: (vacío)
 */
function looksLikeRawBancolombiaCsv(rows: string[][]): boolean {
  const sample = rows.slice(0, 5);
  if (sample.length === 0) return false;
  return sample.every((row) =>
    row.length >= 8 &&
    /^\d{8}$/.test(row[3] ?? "") &&
    /^-?\d+(\.\d+)?$/.test((row[5] ?? "").trim())
  );
}

function parseRawBancolombiaCsv(rows: string[][]): ParsedMovement[] {
  return rows
    .map((row) => ({
      date: normalizeDate(row[3] ?? ""),
      amount: normalizeAmount(row[5] ?? ""),
      reference: (row[4] ?? "").trim(),
      description: (row[7] ?? "").trim(),
    }))
    .filter((m) => m.amount > 0); // solo créditos/abonos
}

/**
 * Extracto en PDF (ej. Bancolombia Sucursal Virtual → Extractos → Descargar PDF).
 * El texto extraído no viene en columnas fijas — cada transacción puede
 * "envolverse" en varias líneas de forma irregular. Se agrupan las líneas
 * por transacción (desde una fecha YYYY/MM/DD hasta la siguiente) y se toma
 * el ÚLTIMO número con dos decimales del bloque como el valor de la
 * transacción — las referencias/documentos del extracto son siempre enteros
 * sin decimales, así que no hay ambigüedad.
 */
async function parsePdfStatement(buffer: Buffer): Promise<ParsedMovement[]> {
  // Import dinámico a propósito: debe cargarse DESPUÉS de aplicar el
  // polyfill de DOMMatrix de arriba, no antes (ver comentario junto al polyfill).
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  let text: string;
  try {
    const result = await parser.getText();
    text = result.text;
  } finally {
    await parser.destroy();
  }

  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  const datePattern = /^(\d{4})\/(\d{2})\/(\d{2})/;
  const amountPattern = /-?[\d,]+\.\d{2}/g;

  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (datePattern.test(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current);

  if (blocks.length === 0) {
    throw new Error(
      "No se encontraron movimientos con formato de fecha (YYYY/MM/DD) en el PDF. " +
      "Verifica que sea el extracto exportado directamente del banco."
    );
  }

  const movements: ParsedMovement[] = [];
  for (const block of blocks) {
    const blockText = block.join(" ");
    const dateStr = block[0].slice(0, 10).replace(/\//g, "-");
    const amounts = [...blockText.matchAll(amountPattern)].map((m) => m[0]);
    if (amounts.length === 0) continue;

    const amount = normalizeAmount(amounts[amounts.length - 1]);
    if (amount <= 0) continue; // solo créditos/abonos

    const description = blockText
      .replace(datePattern, "")
      .replace(amountPattern, "")
      .replace(/\s+/g, " ")
      .trim();

    movements.push({ date: normalizeDate(dateStr), amount, reference: "", description });
  }

  return movements;
}

export async function parseBankStatement(
  buffer: Buffer,
  filename: string
): Promise<ParsedMovement[]> {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    return parsePdfStatement(buffer);
  }

  if (ext === "csv") {
    const text = buffer.toString("latin1");
    const rows = parseCsv(text);
    if (looksLikeRawBancolombiaCsv(rows)) {
      return parseRawBancolombiaCsv(rows);
    }
    try {
      return rowsFromCells(rows);
    } catch (err) {
      const preview = rows.slice(0, 3).map((r) => JSON.stringify(r)).join("\n");
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`${msg}\n\nDiagnóstico — primeras filas detectadas:\n${preview}`);
    }
  }

  if (ext === "xlsx" || ext === "xls") {
    const wb = new ExcelJS.Workbook();
    // Cast: exceljs empaqueta su propia versión de @types/node, cuyo tipo
    // Buffer difiere levemente del de este proyecto (mismo dato en runtime).
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const sheet = wb.worksheets[0];
    const cellsPerRow: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cell.text ?? String(cell.value ?? ""));
      });
      cellsPerRow.push(cells);
    });
    return rowsFromCells(cellsPerRow);
  }

  throw new Error(`Formato no soportado: .${ext}. Usa .xlsx, .xls, .csv o .pdf`);
}
