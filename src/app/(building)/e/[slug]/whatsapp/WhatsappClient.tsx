"use client";

import { useState, useMemo, useActionState, useEffect, useRef } from "react";
import { MessageCircle, Image as ImageIcon, FileText, ExternalLink, Search, Send, Loader2, Contact, MessagesSquare } from "lucide-react";
import type { ConversationSummary, WhatsappMessageView, ContactView } from "./types";
import { sendReply, markSeen, type SendReplyState } from "./actions";

function formatDateTime(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-CO", {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit",
  });
}
function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

function LinkedBadge({ type, id }: { type: string; id: string }) {
  if (type === "pqrs") {
    return (
      <a href={`../pqrs`} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#6366F1]/10 text-[#6366F1] mt-1 hover:underline">
        <ExternalLink className="w-2.5 h-2.5" /> PQRS vinculada
      </a>
    );
  }
  if (type === "payment") {
    return (
      <a href={`../finanzas`} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] mt-1 hover:underline">
        <ExternalLink className="w-2.5 h-2.5" /> Pago vinculado
      </a>
    );
  }
  return null;
}

function ReplyBox({ slug, phone, unitId }: { slug: string; phone: string; unitId: string | null }) {
  const [state, formAction, isPending] = useActionState<SendReplyState, FormData>(
    sendReply.bind(null, slug, phone, unitId),
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  const handledRef = useRef<SendReplyState>(null);

  useEffect(() => {
    if (state?.success && state !== handledRef.current) {
      handledRef.current = state;
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div className="border-t border-border p-3 shrink-0">
      {state?.error && (
        <p className="text-xs text-destructive mb-2">{state.error}</p>
      )}
      <form ref={formRef} action={formAction} className="flex items-end gap-2">
        <textarea
          name="text"
          required
          rows={1}
          placeholder="Escribe una respuesta…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="flex-1 resize-none bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

export default function WhatsappClient({
  slug, conversations, messagesByPhone, contacts,
}: {
  slug: string;
  conversations: ConversationSummary[];
  messagesByPhone: Record<string, WhatsappMessageView[]>;
  contacts: ContactView[];
}) {
  const [panel, setPanel] = useState<"chats" | "contacts">(conversations.length === 0 ? "contacts" : "chats");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(conversations[0]?.phone ?? null);
  const [search, setSearch] = useState("");

  // Al montar (visita real del módulo, no un prefetch de hover) marca los
  // mensajes como vistos y limpia la insignia del sidebar.
  useEffect(() => {
    markSeen(slug);
  }, [slug]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      c.phone.includes(q) || (c.unitNumber ?? "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.unitNumber ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const thread = useMemo(() => {
    if (!selectedPhone) return [];
    return [...(messagesByPhone[selectedPhone] ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  }, [selectedPhone, messagesByPhone]);

  // Info del destinatario seleccionado — resuelve tanto desde una conversación
  // existente como desde un contacto sin historial todavía.
  const selectedInfo = useMemo(() => {
    const conv = conversations.find((c) => c.phone === selectedPhone);
    if (conv) return { unitId: conv.unitId, unitNumber: conv.unitNumber, name: null as string | null };
    const contact = contacts.find((c) => c.phone === selectedPhone);
    if (contact) return { unitId: contact.unitId, unitNumber: contact.unitNumber, name: contact.name };
    return { unitId: null, unitNumber: null, name: null as string | null };
  }, [selectedPhone, conversations, contacts]);

  function handleSelectContact(phone: string) {
    setSelectedPhone(phone);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historial de conversaciones del bot de pagos y PQRS — {conversations.length} conversación{conversations.length !== 1 ? "es" : ""}
        </p>
      </div>

      {conversations.length === 0 && contacts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">Aún no hay mensajes ni contactos</p>
          <p className="text-muted-foreground text-sm">
            Cuando un residente escriba al WhatsApp del edificio, o registres un teléfono en Propietarios, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 bg-card border border-border rounded-xl overflow-hidden" style={{ height: "70vh" }}>
          {/* Lista de conversaciones / contactos */}
          <div className="border-r border-border flex flex-col min-h-0">
            <div className="p-3 border-b border-border space-y-2">
              <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg">
                <button
                  onClick={() => setPanel("chats")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${panel === "chats" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <MessagesSquare className="w-3.5 h-3.5" /> Chats
                </button>
                <button
                  onClick={() => setPanel("contacts")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${panel === "contacts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Contact className="w-3.5 h-3.5" /> Contactos
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={panel === "chats" ? "Buscar por unidad o número…" : "Buscar por nombre, unidad o número…"}
                  className="w-full bg-input border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {panel === "chats" ? (
                <>
                  {filteredConversations.map((c) => (
                    <button
                      key={c.phone}
                      onClick={() => setSelectedPhone(c.phone)}
                      className={`w-full text-left px-3 py-3 border-b border-border transition-colors ${
                        selectedPhone === c.phone ? "bg-primary/10" : "hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {c.unitNumber ? `Unidad ${c.unitNumber}` : c.phone}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(c.lastMessageAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessagePreview}</p>
                    </button>
                  ))}
                  {filteredConversations.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Sin resultados.</p>
                  )}
                </>
              ) : (
                <>
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectContact(c.phone)}
                      className={`w-full text-left px-3 py-3 border-b border-border transition-colors ${
                        selectedPhone === c.phone ? "bg-primary/10" : "hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{c.role}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.unitNumber ? `Unidad ${c.unitNumber} · ` : ""}{c.phone}
                      </p>
                    </button>
                  ))}
                  {filteredContacts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      {contacts.length === 0 ? "Nadie tiene teléfono registrado aún." : "Sin resultados."}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Hilo de mensajes */}
          <div className="flex flex-col min-h-0">
            {selectedPhone ? (
              <>
                <div className="px-4 py-3 border-b border-border shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedInfo.name
                      ? selectedInfo.name
                      : selectedInfo.unitNumber
                      ? `Unidad ${selectedInfo.unitNumber}`
                      : selectedPhone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedInfo.unitNumber && selectedInfo.name ? `Unidad ${selectedInfo.unitNumber} · ` : ""}{selectedPhone}
                  </p>
                </div>
                {thread.length === 0 && (
                  <div className="px-4 py-3 bg-secondary/20 border-b border-border">
                    <p className="text-xs text-muted-foreground">
                      Aún no hay mensajes con este contacto. Escribe abajo para iniciar la conversación.
                    </p>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {thread.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                        m.direction === "outbound" ? "bg-primary text-white" : "bg-secondary text-foreground"
                      }`}>
                        {m.type === "text" ? (
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                        ) : (
                          <div className="flex items-center gap-2 text-sm">
                            {m.type === "image" ? <ImageIcon className="w-4 h-4 shrink-0" /> : <FileText className="w-4 h-4 shrink-0" />}
                            {m.mediaUrl ? (
                              <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline">
                                {m.content || "Ver adjunto"}
                              </a>
                            ) : (
                              <span>{m.content || "Adjunto"}</span>
                            )}
                          </div>
                        )}
                        {m.linkedEntityType && m.linkedEntityId && (
                          <LinkedBadge type={m.linkedEntityType} id={m.linkedEntityId} />
                        )}
                        <p className={`text-[10px] mt-1 ${m.direction === "outbound" ? "text-white/70" : "text-muted-foreground"}`}>
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <ReplyBox
                  slug={slug}
                  phone={selectedPhone}
                  unitId={selectedInfo.unitId}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Selecciona una conversación
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
