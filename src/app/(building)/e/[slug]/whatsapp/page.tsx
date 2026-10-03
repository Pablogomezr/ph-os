import { requireAccesoPanelPagina } from "@/lib/auth/helpers";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc, eq } from "drizzle-orm";
import WhatsappClient from "./WhatsappClient";
import type { ConversationSummary, WhatsappMessageView, ContactView } from "./types";

export default async function WhatsappPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireAccesoPanelPagina(slug, "whatsapp");
  const db = await getTenantDb(slug);

  const [messages, units, users] = await Promise.all([
    db.select().from(tenantSchema.whatsappMessages).orderBy(desc(tenantSchema.whatsappMessages.createdAt)),
    db.select().from(tenantSchema.units),
    db.select().from(tenantSchema.users).where(eq(tenantSchema.users.active, 1)),
  ]);

  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.number]));

  const ROLE_LABELS: Record<string, string> = {
    resident: "Propietario", tenant: "Arrendatario", admin: "Administrador", technician: "Técnico",
  };

  // Contactos con teléfono registrado — para poder escribirles aunque aún no hayan hablado con el bot.
  const contacts: ContactView[] = users
    .filter((u) => !!u.phone)
    .map((u) => {
      let unitIds: string[] = [];
      try { unitIds = JSON.parse(u.unitIds || "[]"); } catch {}
      const unitId = unitIds[0] ?? null;
      return {
        id: u.id,
        name: u.name,
        phone: u.phone as string,
        role: ROLE_LABELS[u.role] ?? u.role,
        unitId,
        unitNumber: unitId ? (unitMap[unitId] ?? null) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const messageViews: WhatsappMessageView[] = messages.map((m) => ({
    id: m.id,
    phone: m.phone,
    unitId: m.unitId,
    unitNumber: m.unitId ? (unitMap[m.unitId] ?? null) : null,
    direction: m.direction as "inbound" | "outbound",
    type: m.type as "text" | "image" | "document",
    content: m.content,
    mediaUrl: m.mediaUrl,
    linkedEntityType: m.linkedEntityType,
    linkedEntityId: m.linkedEntityId,
    createdAt: m.createdAt,
  }));

  // Agrupar por teléfono → conversaciones, más reciente primero
  const byPhone = new Map<string, WhatsappMessageView[]>();
  for (const m of messageViews) {
    if (!byPhone.has(m.phone)) byPhone.set(m.phone, []);
    byPhone.get(m.phone)!.push(m);
  }

  const conversations: ConversationSummary[] = [...byPhone.entries()]
    .map(([phone, msgs]) => {
      const sorted = [...msgs].sort((a, b) => a.createdAt - b.createdAt);
      const last = sorted[sorted.length - 1];
      return {
        phone,
        unitId: sorted.find((m) => m.unitId)?.unitId ?? null,
        unitNumber: sorted.find((m) => m.unitNumber)?.unitNumber ?? null,
        lastMessagePreview: last.type === "text" ? last.content : (last.content || "📎 Adjunto"),
        lastMessageAt: last.createdAt,
        messageCount: sorted.length,
      };
    })
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  return (
    <div className="p-6">
      <WhatsappClient
        slug={slug}
        conversations={conversations}
        messagesByPhone={Object.fromEntries(byPhone)}
        contacts={contacts}
      />
    </div>
  );
}
