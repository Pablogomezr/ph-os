"use server";

import { requireAccesoPanel } from "@/lib/auth/helpers";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { markWhatsappSeen } from "@/lib/whatsapp/unread";

export type SendReplyState = { error?: string; success?: boolean } | null;

// Marca los mensajes de WhatsApp como vistos — limpia la insignia del sidebar.
// Se llama desde el cliente al abrir el módulo (no desde el render de la página,
// para no marcarlos como vistos solo por un prefetch al pasar el mouse sobre el link).
export async function markSeen(slug: string): Promise<void> {
  const { userId } = await requireAccesoPanel(slug);

  await markWhatsappSeen(slug);
  revalidatePath(`/e/${slug}`, "layout");
}

export async function sendReply(
  slug: string,
  phone: string,
  unitId: string | null,
  _prev: SendReplyState,
  formData: FormData
): Promise<SendReplyState> {
  const { userId } = await requireAccesoPanel(slug);

  const text = (formData.get("text") as string)?.trim();
  if (!text) return { error: "Escribe un mensaje." };

  const centralDb = getSuperadminDb();
  const building = await centralDb
    .select({ whatsappPhoneId: superadminSchema.buildings.whatsappPhoneId })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building?.whatsappPhoneId) {
    return { error: "Este edificio no tiene un número de WhatsApp configurado." };
  }

  try {
    await sendWhatsAppMessage(building.whatsappPhoneId, phone, text);
  } catch {
    return { error: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }

  const db = await getTenantDb(slug);
  await db.insert(tenantSchema.whatsappMessages).values({
    id: crypto.randomUUID(),
    unitId,
    phone,
    direction: "outbound",
    type: "text",
    content: text,
    createdAt: Math.floor(Date.now() / 1000),
  });

  revalidatePath(`/e/${slug}/whatsapp`);
  return { success: true };
}
