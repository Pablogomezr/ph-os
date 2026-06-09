"use client";

import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";
import { Building2 } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Building2 className="w-8 h-8 text-primary" />
      </div>

      {/* Icono de sin conexión */}
      <div className="w-12 h-12 rounded-full bg-[#F59E0B]/10 flex items-center justify-center mb-6">
        <WifiOff className="w-6 h-6 text-[#F59E0B]" />
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-3">Sin conexión</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-8 leading-relaxed">
        Parece que no tienes conexión a internet. Verifica tu red y vuelve a intentarlo.
        Algunas páginas ya visitadas pueden estar disponibles en caché.
      </p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors border border-border px-5 py-2.5 rounded-lg"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
