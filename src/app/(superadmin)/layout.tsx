import { requireSuperadmin } from "@/lib/auth/helpers";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Building2, CreditCard, LayoutDashboard } from "lucide-react";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadmin();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">PH OS</p>
              <p className="text-[10px] text-muted-foreground">SuperAdmin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/superadmin"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/superadmin/edificios"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Edificios
          </Link>
          <Link
            href="/superadmin/facturacion"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Facturación
          </Link>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
                userButtonPopoverCard: "bg-card border-border",
              },
            }}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
