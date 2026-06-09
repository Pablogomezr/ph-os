import Link from "next/link";
import { Building2, CheckCircle2, ArrowLeft, HelpCircle, ArrowRight } from "lucide-react";
import { PLANS } from "@/lib/plans";

// ─── Preguntas frecuentes ─────────────────────────────────────────────────────
const FAQ = [
  {
    q: "¿Puedo empezar gratis?",
    a: "Sí. El plan Starter es completamente gratuito hasta 30 unidades e incluye los módulos de finanzas, PQRS y mensajería.",
  },
  {
    q: "¿Qué pasa si supero el límite de unidades?",
    a: "Te avisamos con anticipación para que actualices tu plan. No bloqueamos el acceso de repente — siempre con aviso.",
  },
  {
    q: "¿Los pagos son en pesos colombianos?",
    a: "Los planes se cobran en USD a través de Stripe. Puedes pagar con tarjeta Visa, Mastercard o American Express colombiana.",
  },
  {
    q: "¿Puedo cancelar en cualquier momento?",
    a: "Sí. Sin contratos anuales ni penalizaciones. Al cancelar, mantienes acceso hasta el fin del período pagado.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Cada edificio tiene su propia base de datos aislada en Turso. Nunca compartimos datos entre copropiedades.",
  },
  {
    q: "¿Tienen soporte en español?",
    a: "Sí. Todo el equipo es colombiano. Soporte por correo y chat en español, horario laboral Colombia (GMT-5).",
  },
];

export default function PreciosPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header mínimo */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground">PH<span className="text-primary">OS</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Ingresar
            </Link>
            <Link
              href="/sign-up"
              className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio
          </Link>
          <div className="inline-block bg-[#10B981]/10 text-[#10B981] text-xs px-3 py-1 rounded-full border border-[#10B981]/20 mb-6">
            Precios claros · Sin sorpresas
          </div>
          <h1 className="text-4xl font-extrabold text-foreground mb-4">
            El plan correcto para cada edificio
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Empieza gratis. Crece con el plan que necesites. Sin contratos anuales obligatorios.
          </p>
        </div>
      </section>

      {/* Planes */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                plan.highlight
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xl shadow-primary/10"
                  : "border-border bg-card"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-0.5 rounded-full bg-primary text-white whitespace-nowrap">
                  {plan.badge}
                </span>
              )}

              <div className="mb-5">
                <p className="font-bold text-foreground text-xl">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{plan.tagline}</p>
              </div>

              <div className="mb-6 pb-6 border-b border-border">
                {plan.priceUSD === 0 ? (
                  <p className="text-5xl font-extrabold text-foreground">Gratis</p>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-extrabold text-foreground">${plan.priceUSD}</span>
                    <span className="text-muted-foreground text-sm mb-2"> USD/mes</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {plan.maxUnits ? `Hasta ${plan.maxUnits} unidades` : "Unidades ilimitadas"}
                </p>
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-muted text-foreground hover:bg-muted/80 border border-border"
                }`}
              >
                {plan.priceUSD === 0 ? "Empezar gratis" : "Solicitar acceso"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Todos los precios en USD · Facturación mensual · Cancela en cualquier momento
        </p>
      </section>

      {/* Comparación de características */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-foreground text-center mb-8">
          Comparación detallada
        </h2>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 text-foreground font-semibold">Característica</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`text-center px-5 py-4 font-semibold ${p.highlight ? "text-primary" : "text-foreground"}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Unidades","Hasta 30","Hasta 200","Ilimitadas"],
                ["Dashboard y KPIs","✓","✓","✓"],
                ["Finanzas (cargos y pagos)","✓","✓","✓"],
                ["PQRS","✓","✓","✓"],
                ["Mensajería","✓","✓","✓"],
                ["Contabilidad (Siigo, Excel)","—","✓","✓"],
                ["Energía (medidores kWh)","—","—","✓"],
                ["Mantenimiento (activos)","—","—","✓"],
                ["Soporte","Correo","Prioritario","24/7 SLA"],
                ["Precio","Gratis","$49 USD/mes","$99 USD/mes"],
              ].map(([feat, ...vals], i) => (
                <tr key={feat} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}>
                  <td className="px-5 py-3 text-muted-foreground">{feat}</td>
                  {vals.map((v, j) => (
                    <td key={j} className={`px-5 py-3 text-center font-medium ${
                      v === "✓" ? "text-[#10B981]" :
                      v === "—" ? "text-muted-foreground/40" :
                      j === 1 ? "text-primary" : "text-foreground"
                    }`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 justify-center mb-10">
          <HelpCircle className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Preguntas frecuentes</h2>
        </div>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="bg-card border border-border rounded-xl p-5">
              <p className="font-semibold text-foreground mb-2 text-sm">{item.q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-primary/20 via-card to-[#22D3EE]/10 border border-primary/30 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">¿Listo para empezar?</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Crea tu cuenta y comienza a gestionar tu copropiedad hoy. Gratis, sin tarjeta.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            Empezar gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2026 Propiedad Horizontal OS · Construido para Colombia 🇨🇴</p>
          <Link href="/" className="hover:text-foreground transition-colors">← Volver al inicio</Link>
        </div>
      </footer>
    </div>
  );
}
