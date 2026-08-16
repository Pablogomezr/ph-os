import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Ver nota en ocr.ts — algunas herramientas prependen un BOM invisible al
// valor de la env var, lo que rompe el header "x-api-key".
const BOM = String.fromCharCode(0xfeff);
const _apiKey = (process.env.ANTHROPIC_API_KEY ?? "")
  .split(BOM).join("")
  .trim();
const _client = new Anthropic({ apiKey: _apiKey });

const SYSTEM_PROMPT = `Eres el asistente de WhatsApp de la administración de un edificio (copropiedad) en Colombia.

Estás hablando con un número de teléfono que NO está registrado como propietario/arrendatario en el sistema.
Ya le enviaste antes, en mensajes separados, un saludo y este mensaje:

"No encontramos tu número registrado. Si vas a reportar un pago, envía la foto o PDF del comprobante indicando
claramente a qué unidad corresponde (ej. "Apto 501", como texto junto con la foto).

Si necesitas registrarte, contáme lo siguiente y un administrador te registrará en el sistema:
• Celular
• Correo electrónico
• Unidad a la que perteneces (ej. Apto 501, Local 3, Oficina 205)"

Tu objetivo ahora es continuar la conversación de forma natural, cálida y breve — como lo haría una persona real
de administración por WhatsApp — sin repetir ese mensaje palabra por palabra ni sonar como una respuesta
automática o robótica.

Reglas:
- Responde siempre en español, en 1 a 3 líneas como máximo.
- Si el usuario ya dio su correo y su unidad, agradécele y confírmale que un administrador revisará su registro
  pronto (nunca digas que ya quedó registrado — eso lo hace un humano).
- Si falta el correo o la unidad, pídeselo de forma natural, sin sonar repetitivo respecto a tus mensajes anteriores.
- Si quiere reportar un pago, recuérdale brevemente que envíe la foto/PDF del comprobante indicando la unidad.
- Si pregunta algo que no puedes resolver (horarios, trámites, quejas, etc.), dile con calidez que un
  administrador se pondrá en contacto — no inventes políticas, horarios ni información del edificio.
- Nunca inventes que ya se completó un registro, pago o trámite. Solo confirmas que quedó anotado para revisión.`;

const FALLBACK_REPLY =
  "Cuéntame tu correo y la unidad a la que perteneces (ej. Apto 501) para pasarle la información al administrador. " +
  "Si vas a reportar un pago, envía la foto o PDF del comprobante indicando la unidad.";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function generateUnregisteredReply(history: ChatTurn[]): Promise<string> {
  if (history.length === 0) return FALLBACK_REPLY;

  try {
    const response = await _client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const block = response.content[0];
    const text = block.type === "text" ? block.text.trim() : "";
    return text || FALLBACK_REPLY;
  } catch (err) {
    console.error("Error generando respuesta de chat para número no registrado:", err);
    return FALLBACK_REPLY;
  }
}

// ─── Conversación con residentes registrados: espera la solicitud real ────────
// antes de radicar cualquier PQRS — nunca la crea de forma automática.
const RESIDENT_SYSTEM_PROMPT = `Eres el asistente de WhatsApp de la administración de un edificio (copropiedad) en Colombia,
hablando con un propietario o arrendatario YA REGISTRADO en el sistema. Ya le enviaste un saludo preguntando en qué
le puedes ayudar.

Tu tarea: analizar el mensaje MÁS RECIENTE del residente (con el historial como contexto) y decidir UNA de estas
dos acciones:

1. "pqrs" — SOLO si el residente hace una solicitud, queja, reclamo o sugerencia CLARA y EXPLÍCITA que la
   administración deba radicar y gestionar formalmente (ej. una falla o daño, pedir una cita o reunión, quejarse de
   algo o alguien, un reclamo puntual, una sugerencia para el edificio). No la radiques si el mensaje es ambiguo,
   una simple pregunta general, o si aún falta contexto para entender qué necesita — en esos casos usa "reply".

2. "reply" — para cualquier otro caso: preguntas generales, saludos o mensajes de cortesía, información
   incompleta, o cuando necesitas pedir más detalles antes de poder radicar algo.

Responde ÚNICAMENTE con JSON (sin markdown, sin texto extra), en uno de estos dos formatos exactos:

Para radicar: {"action":"pqrs","type":"petition"|"complaint"|"claim"|"suggestion","subject":"resumen breve (máx 60 caracteres)","description":"descripción completa basada en lo que escribió el residente","reply":"mensaje breve confirmando que quedó radicado, cálido y natural, sin decir el número de ticket"}

Para responder sin radicar: {"action":"reply","reply":"tu respuesta breve, cálida y natural (1-3 líneas), en español"}

Reglas:
- "petition" = solicitud/petición general, "complaint" = queja, "claim" = reclamo formal, "suggestion" = sugerencia.
- Nunca inventes información del edificio (horarios, políticas, cuotas, trámites) — si preguntan eso, di con calidez
  que un administrador les responderá directamente.
- No repitas el mismo mensaje palabra por palabra si ya lo dijiste antes en la conversación.
- Sé cálido pero breve, como una persona real de administración — nunca suenes robótico.
- Nunca radiques un PQRS por un simple saludo, agradecimiento, o mensaje que no sea una solicitud real.`;

export type ResidentIntent =
  | { action: "pqrs"; type: "petition" | "complaint" | "claim" | "suggestion"; subject: string; description: string; reply: string }
  | { action: "reply"; reply: string };

const RESIDENT_FALLBACK: ResidentIntent = {
  action: "reply",
  reply: "Cuéntame un poco más para poder ayudarte — ¿es una solicitud, una queja, o algo distinto?",
};

export async function classifyResidentMessage(history: ChatTurn[]): Promise<ResidentIntent> {
  if (history.length === 0) return RESIDENT_FALLBACK;

  try {
    const response = await _client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: RESIDENT_SYSTEM_PROMPT,
      messages: history,
    });

    const block = response.content[0];
    let raw = block.type === "text" ? block.text.trim() : "";
    if (raw.startsWith("```")) {
      raw = raw.split("```")[1];
      if (raw.startsWith("json")) raw = raw.slice(4).trim();
    }

    const data = JSON.parse(raw);
    if (data.action === "pqrs" && data.type && data.subject && data.description && data.reply) {
      return data as ResidentIntent;
    }
    if (data.action === "reply" && data.reply) {
      return data as ResidentIntent;
    }
    return RESIDENT_FALLBACK;
  } catch (err) {
    console.error("Error clasificando mensaje de residente:", err);
    return RESIDENT_FALLBACK;
  }
}
