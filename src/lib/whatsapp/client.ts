import "server-only";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function token(): string {
  const t = process.env.WHATSAPP_TOKEN;
  if (!t) throw new Error("WHATSAPP_TOKEN no configurado");
  return t;
}

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  body: string
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Meta rechazó el mensaje de WhatsApp (${res.status}): ${detail}`);
  }
}

export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!metaRes.ok) throw new Error(`No se pudo obtener metadata del media ${mediaId}`);
  const meta = await metaRes.json();

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!fileRes.ok) throw new Error(`No se pudo descargar el media ${mediaId}`);

  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  return { bytes, mimeType: meta.mime_type ?? "image/jpeg" };
}

// ─── Parseo del payload entrante de Meta ──────────────────────────────────────
export type IncomingWhatsAppMessage = {
  phoneNumberId: string;
  from: string;
  type: "text" | "image" | "document";
  text?: string;
  mediaId?: string;
  mimeType?: string;
  caption?: string;
};

export function parseIncomingWebhook(body: unknown): IncomingWhatsAppMessage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (body as any)?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    const message = value?.messages?.[0];

    if (!phoneNumberId || !message) return null;

    const from = message.from;

    if (message.type === "text") {
      return { phoneNumberId, from, type: "text", text: message.text?.body ?? "" };
    }
    if (message.type === "image") {
      return {
        phoneNumberId, from, type: "image",
        mediaId: message.image?.id, mimeType: message.image?.mime_type,
        caption: message.image?.caption,
      };
    }
    if (message.type === "document") {
      return {
        phoneNumberId, from, type: "document",
        mediaId: message.document?.id, mimeType: message.document?.mime_type,
        caption: message.document?.caption,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Envía una PLANTILLA pre-aprobada por Meta.
 *
 * Fuera de la ventana de 24 horas desde el último mensaje del usuario, WhatsApp
 * no permite texto libre. Los avisos de cartera son conversaciones iniciadas
 * por el negocio, así que obligatoriamente van por esta vía.
 *
 * Efecto secundario feliz: la plantilla es literalmente cerrada. El agente no
 * puede improvisar el texto, solo llenar variables — por eso estos envíos
 * pueden ser autónomos sin riesgo de que escriba algo inconveniente.
 */
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  to: string,
  plantilla: string,
  idioma: string,
  variables: readonly string[],
): Promise<{ waMessageId: string | null }> {
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: plantilla,
        language: { code: idioma },
        components: variables.length > 0
          ? [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) }]
          : [],
      },
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Meta rechazó la plantilla "${plantilla}" (${res.status}): ${detalle}`);
  }

  const cuerpo = await res.json().catch(() => null);
  return { waMessageId: cuerpo?.messages?.[0]?.id ?? null };
}
