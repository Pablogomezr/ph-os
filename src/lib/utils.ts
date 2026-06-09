import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un valor en pesos colombianos.
 * SIEMPRE usar esta función — nunca formatear COP manualmente.
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formatea Unix timestamp como fecha en español */
export function formatDate(timestamp: number, pattern = "dd/MM/yyyy"): string {
  return format(new Date(timestamp * 1000), pattern, { locale: es });
}

/** Tiempo relativo: "hace 3 días" */
export function timeAgo(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp * 1000), {
    addSuffix: true,
    locale: es,
  });
}

/** Genera ID único */
export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Convierte texto a slug URL-friendly */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Unix timestamp → Date */
export function fromUnix(ts: number): Date {
  return new Date(ts * 1000);
}

/** Date → Unix timestamp */
export function toUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Calcula cargo por coeficiente de copropiedad */
export function calculateByCoefficient(
  base: number,
  coefficient: number
): number {
  return Math.round(base * coefficient);
}
