"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard, Home, Users, CircleDollarSign,
  Zap, Wrench, MessageCircle, Bell, FileSpreadsheet,
  ChevronLeft, Building2, CreditCard, HardHat, Menu, X,
} from "lucide-react";
import type { Module } from "@/lib/modules/checker";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  module?: Module;
}

interface BuildingSidebarProps {
  slug: string;
  buildingName: string;
  city: string | null;
  activeModules: Module[];
  isSuperadmin: boolean;
}

function buildNavItems(slug: string, activeModules: Module[]): NavItem[] {
  const base = `/e/${slug}`;
  const all: NavItem[] = [
    { href: `${base}/dashboard`,    label: "Dashboard",    icon: LayoutDashboard },
    { href: `${base}/unidades`,     label: "Unidades",     icon: Home,              module: "base" },
    { href: `${base}/residentes`,   label: "Propietarios",   icon: Users,             module: "base" },
    { href: `${base}/finanzas`,     label: "Finanzas",     icon: CircleDollarSign,  module: "finanzas" },
    { href: `${base}/energia`,      label: "Energía",      icon: Zap,               module: "energia" },
    { href: `${base}/mantenimiento`,label: "Mantenimiento",icon: Wrench,            module: "mantenimiento" },
    { href: `${base}/pqrs`,         label: "PQRS",         icon: MessageCircle,     module: "pqrs" },
    { href: `${base}/mensajeria`,   label: "Mensajería",   icon: Bell,              module: "mensajeria" },
    { href: `${base}/contabilidad`, label: "Contabilidad", icon: FileSpreadsheet,   module: "contabilidad" },
    { href: `${base}/billing`,      label: "Facturación",  icon: CreditCard },
    { href: `${base}/operadores`,   label: "Operadores",   icon: HardHat,           module: "energia" },
  ];

  return all.filter(
    (item) => !item.module || item.module === "base" || activeModules.includes(item.module)
  );
}

export default function BuildingSidebar({
  slug,
  buildingName,
  city,
  activeModules,
  isSuperadmin,
}: BuildingSidebarProps) {
  const pathname = usePathname();
  const navItems = buildNavItems(slug, activeModules);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cerrar el menú móvil al cambiar de página
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Barra superior móvil con botón hamburguesa */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-sidebar-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-sm font-bold text-foreground truncate">{buildingName}</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Fondo oscuro al abrir el menú en móvil */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
        />
      )}

      <aside
        className={cn(
          "w-64 md:w-60 bg-sidebar border-r border-sidebar-border flex flex-col h-screen shrink-0",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header del edificio */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate leading-tight">{buildingName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{city ?? "Colombia"}</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-white font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {isSuperadmin && (
            <Link
              href="/superadmin"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Volver a SuperAdmin
            </Link>
          )}
          <div className="px-3 py-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7",
                  userButtonPopoverCard: "bg-card border-border",
                },
              }}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
