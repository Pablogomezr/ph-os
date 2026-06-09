/**
 * PHOS — Service Worker
 *
 * Estrategia:
 *   - Assets estáticos (_next/static/**): Cache First (offline-ready)
 *   - Iconos/imágenes (public/**):        Cache First
 *   - Páginas HTML / API:                 Network First con fallback offline
 */

const CACHE_NAME    = "phos-v1";
const STATIC_CACHE  = "phos-static-v1";
const OFFLINE_URL   = "/offline";

// Recursos a pre-cachear en el install
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ─── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            // Silencia errores si la URL no existe todavía
          })
        )
      );
    })
  );
  // Activa de inmediato sin esperar que el SW anterior muera
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  // Toma control de todos los clientes de inmediato
  self.clients.claim();
});

// ─── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejamos GET
  if (request.method !== "GET") return;

  // No interceptar llamadas a Clerk / Stripe / APIs externas
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr")
  ) {
    return;
  }

  // ── Cache First: assets estáticos de Next.js ──────────────────────────────
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Network First: páginas HTML ───────────────────────────────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachea respuestas HTML exitosas
        if (response.ok && request.headers.get("accept")?.includes("text/html")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Sin conexión: busca en caché o página offline
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.headers.get("accept")?.includes("text/html")) {
          return caches.match(OFFLINE_URL) || Response.error();
        }
        return Response.error();
      })
  );
});

// ─── Push Notifications (preparado para futuras notificaciones) ───────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title ?? "PHOS", {
        body:    data.body    ?? "",
        icon:    data.icon    ?? "/icons/icon-192x192.png",
        badge:   data.badge   ?? "/icons/icon-96x96.png",
        tag:     data.tag     ?? "phos-notification",
        data:    data.url     ?? "/",
        actions: data.actions ?? [],
      })
    );
  } catch {
    // Payload no es JSON — ignorar
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url === url && "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
