import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MIME_MAP: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "application/pdf": "application/pdf",
};

const PROMPT = `Analiza este comprobante de pago bancario y extrae los datos en JSON.

Campos requeridos:
- nombre: nombre completo del titular o remitente (string o null)
- fecha: fecha de la transacción en formato YYYY-MM-DD (string o null)
- monto: valor numérico sin símbolos ni puntos de miles (number o null)
- referencia: número de referencia/operación/transacción (string o null)
- banco_emisor: nombre del banco desde donde se realizó el pago (string o null)
- concepto: motivo — Administración, Parqueadero, Cuota Extraordinaria u otro (string o null)

Reglas:
1. monto debe ser número puro: 350000, no "$350.000"
2. Si un campo no es visible o ilegible → null
3. Si menos de 3 campos son legibles → incluye "valid": false
4. De lo contrario → incluye "valid": true
5. Responde ÚNICAMENTE con el JSON. Sin markdown, sin texto extra.

Ejemplo de salida válida:
{"valid":true,"nombre":"Carlos García","fecha":"2024-01-15","monto":350000,"referencia":"20240115001","banco_emisor":"Bancolombia","concepto":"Administración"}`;

export type ExtractedPayment = {
  valid: boolean;
  nombre?: string | null;
  fecha?: string | null;
  monto?: number | null;
  referencia?: string | null;
  banco_emisor?: string | null;
  concepto?: string | null;
  error?: string;
};

export async function extractPaymentData(
  bytes: Uint8Array,
  mimeType: string
): Promise<ExtractedPayment> {
  const claudeMime = MIME_MAP[mimeType] ?? "image/jpeg";
  const b64 = Buffer.from(bytes).toString("base64");

  const mediaBlock =
    claudeMime === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: claudeMime, data: b64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: claudeMime, data: b64 } };

  try {
    const response = await _client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: [mediaBlock, { type: "text", text: PROMPT }] }],
    });

    const block = response.content[0];
    let raw = block.type === "text" ? block.text.trim() : "";

    if (raw.startsWith("```")) {
      raw = raw.split("```")[1];
      if (raw.startsWith("json")) raw = raw.slice(4).trim();
    }

    const data = JSON.parse(raw);
    if (data.valid === undefined) data.valid = true;
    return data;
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
