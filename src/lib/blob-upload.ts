import "server-only";
import { put } from "@vercel/blob";

/**
 * Sube uno o más archivos a Vercel Blob y devuelve sus URLs públicas.
 * Ignora archivos vacíos (inputs sin selección).
 */
export async function uploadAttachments(
  files: File[],
  pathPrefix: string
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${pathPrefix}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

    const blob = await put(key, file, { access: "public" });
    urls.push(blob.url);
  }

  return urls;
}

/** Sube bytes crudos (ej. un archivo descargado de WhatsApp) y devuelve la URL pública. */
export async function uploadBytes(
  bytes: Uint8Array,
  pathPrefix: string,
  extension: string
): Promise<string> {
  const key = `${pathPrefix}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const blob = await put(key, Buffer.from(bytes), { access: "public" });
  return blob.url;
}
