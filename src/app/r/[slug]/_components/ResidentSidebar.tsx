"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard, Receipt, MessageSquare, Bell,
  User, Building2, ChevronLeft, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResidentSidebarProps {
  slug:         string;
  buildingName: string;
  unitNumbers:  string[];
  userName:     string;
}

const NAV_ITEMS = (slug: string) => [
  { href: `/r/${slug}/dashboard`,  label: "Mi panel",      icon: LayoutDashboard },
  { href: `/r/${slug}/cargos`,     label: "Mis cargos",    icon: Receipt         },
  { href: `/r/${slug}/pqrs`,       label: "PQRS",          icon: MessageSquare   },
  { href: `/r/${slug}/mensajeria`, label: "Comunicados",   icon: Bell            },
  { href: `/r/${slug}/perfil`,     label: "Mi perfil",     icon: User            },
];

export default function ResidentSidebar({
  slug, buildingName, unitNumbers, userName,
}: ResidentSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Barra superior móvil */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-sidebar-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#22D3EE]/20 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#22D3EE]" />
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
        {/* Edificio */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/20 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-[#22D3EE]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate leading-tight">{buildingName}</p>
                <p className="text-[10px] text-muted-foreground">Portal residentes</p>
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
          {/* Mis unidades */}
          {unitNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {unitNumbers.map((u) => (
                <span key={u} className="text-[10px] font-semibold bg-[#22D3EE]/10 text-[#22D3EE] px-2 py-0.5 rounded-full">
                  Apto {u}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS(slug).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-[#22D3EE]/20 text-[#22D3EE] font-medium"
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
          <div className="px-3 py-1.5 flex items-center gap-2.5">
            <UserButton
              appearance={{ elements: { avatarBox: "w-7 h-7" } }}
            />
            <p className="text-xs text-muted-foreground truncate">{userName}</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Ir al inicio
          </Link>
        </div>
      </aside>
    </>
  );
}
