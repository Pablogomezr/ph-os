export type WhatsappMessageView = {
  id: string;
  phone: string;
  unitId: string | null;
  unitNumber: string | null;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "document";
  content: string;
  mediaUrl: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  createdAt: number;
};

export type ConversationSummary = {
  phone: string;
  unitId: string | null;
  unitNumber: string | null;
  lastMessagePreview: string;
  lastMessageAt: number;
  messageCount: number;
};

export type ContactView = {
  id: string;
  name: string;
  phone: string;
  role: string;
  unitId: string | null;
  unitNumber: string | null;
};
