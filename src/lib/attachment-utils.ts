/** Extrae el nombre de archivo legible a partir de una URL de Vercel Blob. */
export function attachmentFileName(url: string): string {
  const last = url.split("/").pop() ?? url;
  // Quita el prefijo "<timestamp>-<random>-" que agrega uploadAttachments
  return decodeURIComponent(last.replace(/^\d+-[a-z0-9]+-/, ""));
}
