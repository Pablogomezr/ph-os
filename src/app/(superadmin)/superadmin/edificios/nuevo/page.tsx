import Link from "next/link";
import { ChevronRight } from "lucide-react";
import NuevoEdificioForm from "./NuevoEdificioForm";

export default function NuevoEdificioPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/superadmin" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/superadmin/edificios" className="hover:text-foreground transition-colors">Edificios</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Nuevo</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nuevo Edificio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Registra una copropiedad. En desarrollo se crea una DB SQLite local; en producción se aprovisiona automáticamente en Turso.
        </p>
      </div>

      {/* Formulario */}
      <NuevoEdificioForm />
    </div>
  );
}
