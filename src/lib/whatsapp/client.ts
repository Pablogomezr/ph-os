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
  await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
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
      };
    }
    if (message.type === "document") {
      return {
        phoneNumberId, from, type: "document",
        mediaId: message.document?.id, mimeType: message.document?.mime_type,
      };
    }
    return null;
  } catch {
    return null;
  }
}
