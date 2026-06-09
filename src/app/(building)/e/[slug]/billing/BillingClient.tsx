"use client";

import { useState } from "react";
import { CheckCircle2, Zap, Building2, Sparkles, ExternalLink, CreditCard, AlertTriangle } from "lucide-react";
import { PLANS, getPlanById, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────
interface BillingClientProps {
  slug:                  string;
  currentPlan:           PlanId;
  buildingStatus:        string;
  hasStripeCustomer:     boolean;
  hasStripeSubscription: boolean;
  successParam:          boolean;
  cancelledParam:        boolean;
  /** Price IDs inyectados desde el server component (env vars NEXT_PUBLIC_*) */
  proPriceId:            string | undefined;
  enterprisePriceId:     string | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLAN_ICONS: Record<PlanId, React.ComponentType<{ className?: string }>> = {
  base:         Building2,
  profesional:  Zap,
  empresarial:  Sparkles,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: "Activo",    color: "bg-[#10B981]/10 text-[#10B981]"  },
  trial:     { label: "Prueba",    color: "bg-[#F59E0B]/10 text-[#F59E0B]"  },
  suspended: { label: "Suspendido",color: "bg-[#EF4444]/10 text-[#EF4444]"  },
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function BillingClient({
  slug,
  currentPlan,
  buildingStatus,
  hasStripeCustomer,
  hasStripeSubscription,
  successParam,
  cancelledParam,
  proPriceId,
  enterprisePriceId,
}: BillingClientProps) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlan = getPlanById(currentPlan);
  const statusInfo = STATUS_LABELS[buildingStatus] ?? STATUS_LABELS["active"];
  const PlanIcon   = PLAN_ICONS[currentPlan] ?? Building2;

  // Mapa priceEnvKey → priceId real (inyectado desde server)
  const priceIdMap: Record<string, string | undefined> = {
    NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL: proPriceId,
    NEXT_PUBLIC_STRIPE_PRICE_EMPRESARIAL: enterprisePriceId,
  };

  async function handleCheckout(priceId: string) {
    setError(null);
    setLoadingPriceId(priceId);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug, priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al iniciar el pago");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoadingPriceId(null);
    }
  }

  async function handlePortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const res  = await fetch("/api/stripe/portal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al abrir el portal");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setPortalLoading(false);
    }
  }

  const stripeConfigured = !!(proPriceId || enterprisePriceId);

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Facturación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona tu suscripción y plan de Propiedad Horizontal OS
        </p>
      </div>

      {/* Banners de éxito / cancelación */}
      {successParam && (
        <div className="flex items-center gap-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl px-4 py-3 text-sm text-[#10B981]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>¡Suscripción activada exitosamente! Bienvenido al plan {activePlan.name}.</span>
        </div>
      )}
      {cancelledParam && (
        <div className="flex items-center gap-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-4 py-3 text-sm text-[#F59E0B]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>El proceso de pago fue cancelado. Puedes intentarlo nuevamente cuando quieras.</span>
        </div>
      )}

      {/* Plan actual */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Plan actual
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <PlanIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">{activePlan.name}</p>
              <p className="text-sm text-muted-foreground">{activePlan.priceLabel}</p>
            </div>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", statusInfo.color)}>
              {statusInfo.label}
            </span>
            {hasStripeSubscription && (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50"
              >
                {portalLoading ? (
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ExternalLink className="w-3 h-3" />
                )}
                Gestionar suscripción
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Advertencia si Stripe no está configurado */}
      {!stripeConfigured && (
        <div className="flex items-start gap-3 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4 text-sm">
          <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#F59E0B]">Stripe no configurado</p>
            <p className="text-muted-foreground text-xs mt-1">
              Agrega <code className="font-mono bg-muted px-1 rounded">NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL</code> y{" "}
              <code className="font-mono bg-muted px-1 rounded">NEXT_PUBLIC_STRIPE_PRICE_EMPRESARIAL</code> en tu{" "}
              <code className="font-mono bg-muted px-1 rounded">.env.local</code> para habilitar los pagos.
            </p>
          </div>
        </div>
      )}

      {/* Error global */}
      {error && (
        <div className="flex items-center gap-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Cards de planes */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-4">Planes disponibles</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const PIcon = PLAN_ICONS[plan.id] ?? Building2;
            const priceId = plan.priceEnvKey ? priceIdMap[plan.priceEnvKey] : null;
            const isLoading = priceId ? loadingPriceId === priceId : false;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border p-5 transition-all",
                  plan.highlight
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card",
                  isCurrentPlan && "ring-2 ring-primary"
                )}
              >
                {/* Badge */}
                {plan.badge && (
                  <span className="absolute -top-2.5 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                    {plan.badge}
                  </span>
                )}

                {/* Icono + nombre */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("p-2 rounded-lg", plan.highlight ? "bg-primary/20" : "bg-muted")}>
                    <PIcon className={cn("w-4 h-4", plan.highlight ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{plan.name}</p>
                    <p className="text-[10px] text-muted-foreground">{plan.tagline}</p>
                  </div>
                </div>

                {/* Precio */}
                <div className="mb-4">
                  {plan.priceUSD === 0 ? (
                    <p className="text-2xl font-bold text-foreground">Gratis</p>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-foreground">${plan.priceUSD}</span>
                      <span className="text-sm text-muted-foreground"> USD/mes</span>
                    </>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-1.5 flex-1 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrentPlan ? (
                  <div className="w-full py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold text-center">
                    Plan actual ✓
                  </div>
                ) : plan.priceUSD === 0 ? (
                  <div className="w-full py-2 rounded-lg bg-muted text-muted-foreground text-sm font-semibold text-center">
                    Plan gratuito
                  </div>
                ) : priceId ? (
                  <button
                    onClick={() => handleCheckout(priceId)}
                    disabled={isLoading || !stripeConfigured}
                    className={cn(
                      "w-full py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                      plan.highlight
                        ? "bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                        : "bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50"
                    )}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Redirigiendo…
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-3.5 h-3.5" />
                        {currentPlan === "base" ? "Suscribirse" : "Cambiar plan"}
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full py-2 rounded-lg bg-muted/50 text-muted-foreground text-xs font-medium text-center">
                    Price ID no configurado
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info de seguridad */}
      <div className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground flex items-start gap-3">
        <CreditCard className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p>
          Los pagos son procesados de forma segura por{" "}
          <span className="font-semibold text-foreground">Stripe</span>. Tus datos de tarjeta
          nunca son almacenados en nuestros servidores. Puedes cancelar tu suscripción en
          cualquier momento desde el portal de cliente.
        </p>
      </div>
    </>
  );
}
