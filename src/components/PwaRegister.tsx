"use client";

import { useEffect } from "react";

/**
 * Registra el service worker de PHOS en el navegador.
 * Solo se ejecuta en cliente (use client) y solo en producción o si
 * NEXT_PUBLIC_SW_DEV=true para pruebas locales.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // En desarrollo solo activa si se setea la variable de entorno
    const isDev = process.env.NODE_ENV === "development";
    if (isDev && process.env.NEXT_PUBLIC_SW_DEV !== "true") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PHOS SW] Registrado:", registration.scope);

        // Escucha actualizaciones del SW
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // Hay una nueva versión disponible — se podría mostrar un toast aquí
              console.log("[PHOS SW] Nueva versión disponible. Recarga para actualizar.");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PHOS SW] Error al registrar:", err);
      });
  }, []);

  return null; // No renderiza nada visible
}
