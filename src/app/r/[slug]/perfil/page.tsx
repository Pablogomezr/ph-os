import { requireResidentContext } from "@/lib/resident-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { inArray } from "drizzle-orm";
import { UserButton } from "@clerk/nextjs";
import { User, Phone, Mail, Building2, Hash } from "lucide-react";

function roleLabel(role: string) {
  if (role === "resident") return "Propietario";
  if (role === "tenant") return "Arrendatario";
  if (role === "admin") return "Administrador";
  return "Técnico";
}

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="p-2 rounded-lg bg-muted shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value || "—"}</p>
      </div>
    </div>
  );
}

export default async function ResidentPerfilPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireResidentContext(slug);
  const db  = await getTenantDb(slug);

  const units = ctx.unitIds.length
    ? await db
        .select({
          number: tenantSchema.units.number,
          type:   tenantSchema.units.type,
          floor:  tenantSchema.units.floor,
        })
        .from(tenantSchema.units)
        .where(inArray(tenantSchema.units.id, ctx.unitIds))
    : [];

  const UNIT_TYPE_LABELS: Record<string, string> = {
    apartment: "Apartamento", office: "Oficina", commercial: "Local comercial",
  };

  return (
    <div className="p-6 space-y-5 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Tu información en el edificio</p>
      </div>

      {/* Avatar + datos básicos */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {ctx.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-foreground text-lg">{ctx.user.name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel(ctx.user.role)}</p>
          </div>
        </div>

        <InfoRow icon={Mail}     label="Correo electrónico" value={ctx.user.email} />
        <InfoRow icon={Phone}    label="Teléfono"           value={ctx.user.phone} />
        <InfoRow icon={User}     label="Rol"                value={roleLabel(ctx.user.role)} />
      </div>

      {/* Unidades */}
      {units.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Mis unidades</p>
          </div>
          <div className="divide-y divide-border">
            {units.map((u) => (
              <div key={u.number} className="flex items-center gap-3 px-5 py-3">
                <div className="p-2 rounded-lg bg-[#22D3EE]/10 shrink-0">
                  <Building2 className="w-4 h-4 text-[#22D3EE]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {UNIT_TYPE_LABELS[u.type] ?? u.type} {u.number}
                  </p>
                  {u.floor && (
                    <p className="text-xs text-muted-foreground">Piso {u.floor}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestionar cuenta Clerk */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-foreground mb-1">Cuenta y seguridad</p>
        <p className="text-xs text-muted-foreground mb-4">
          Cambia tu contraseña, correo o activa autenticación de dos factores desde el panel de cuenta.
        </p>
        <div className="flex items-center gap-3">
          <UserButton
            appearance={{ elements: { avatarBox: "w-8 h-8" } }}
            showName
          />
          <p className="text-xs text-muted-foreground">Haz clic en tu avatar para gestionar la cuenta</p>
        </div>
      </div>
    </div>
  );
}
