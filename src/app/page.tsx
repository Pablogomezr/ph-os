import Link from "next/link";
import {
  Building2, Zap, Wrench, MessageSquare, Bell,
  FileSpreadsheet, CircleDollarSign, ArrowRight,
  CheckCircle2, Shield, Globe, CreditCard,
  BarChart3, Users, Star,
} from "lucide-react";
import { PLANS } from "@/lib/plans";

// ─── Datos ─────────────────────────────────────────────────────────────────────
const MODULES = [
  {
    icon: CircleDollarSign, name: "Finanzas",
    description: "Cargos masivos e individuales, pagos, presupuesto anual y reportes financieros detallados.",
    color: "text-[#6366F1]", bg: "bg-[#6366F1]/10", border: "border-[#6366F1]/20",
  },
  {
    icon: Zap, name: "Energía",
    description: "Lecturas de medidores kWh, cálculo automático de consumo y generación de cargos por unidad.",
    color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10", border: "border-[#22D3EE]/20",
  },
  {
    icon: Wrench, name: "Mantenimiento",
    description: "Inventario de activos, tareas preventivas y correctivas con seguimiento de estado y prioridad.",
    color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/20",
  },
  {
    icon: MessageSquare, name: "PQRS",
    description: "Peticiones, quejas, reclamos y sugerencias con trazabilidad completa y tiempo de respuesta.",
    color: "text-[#10B981]", bg: "bg-[#10B981]/10", border: "border-[#10B981]/20",
  },
  {
    icon: Bell, name: "Mensajería",
    description: "Circulares, anuncios y actas para residentes. Flujo de borradores y publicación oficial.",
    color: "text-[#6366F1]", bg: "bg-[#6366F1]/10", border: "border-[#6366F1]/20",
  },
  {
    icon: FileSpreadsheet, name: "Contabilidad",
    description: "Exportación a Siigo, World Office, Excel y CSV. Formato listo para contadores colombianos.",
    color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10", border: "border-[#22D3EE]/20",
  },
];

const STATS = [
  { value: "500+",   label: "Unidades activas",       icon: Building2  },
  { value: "12",     label: "Copropiedades",           icon: Globe      },
  { value: "99.9%",  label: "Uptime garantizado",      icon: Shield     },
  { value: "4.9★",   label: "Satisfacción de admins",  icon: Star       },
];

const HOW_IT_WORKS = [
  {
    step: "01", title: "Crea tu edificio",
    description: "Registra tu copropiedad en minutos. Carga las unidades, residentes y configura los módulos que necesitas.",
    icon: Building2,
  },
  {
    step: "02", title: "Activa y administra",
    description: "Genera cargos, registra pagos, gestiona mantenimiento y responde PQRS desde un panel unificado.",
    icon: BarChart3,
  },
  {
    step: "03", title: "Exporta y reporta",
    description: "Exporta movimientos a Siigo o World Office con un clic. Comparte reportes con la asamblea.",
    icon: FileSpreadsheet,
  },
];

// ─── Header ────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground">PH<span className="text-primary">OS</span></span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="#modulos" className="text-muted-foreground hover:text-foreground transition-colors">Módulos</Link>
          <Link href="#como-funciona" className="text-muted-foreground hover:text-foreground transition-colors">Cómo funciona</Link>
          <Link href="#precios" className="text-muted-foreground hover:text-foreground transition-colors">Precios</Link>
        </nav>
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
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-28 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-full mb-8 border border-primary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Hecho para Colombia 🇨🇴 · Multi-tenant · Datos aislados por edificio
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-[1.1] tracking-tight mb-6">
          Gestiona tu copropiedad{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#22D3EE]">
            desde cualquier parte
          </span>{" "}
          del mundo
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Plataforma SaaS para administradores de propiedades horizontales en Colombia.
          Finanzas, energía, mantenimiento, PQRS y exportación contable en un solo lugar.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-primary text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Empezar gratis <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#precios"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border px-7 py-3.5 rounded-xl transition-colors"
          >
            Ver precios
          </Link>
        </div>

        {/* Mini trust */}
        <p className="mt-6 text-xs text-muted-foreground">
          Sin tarjeta de crédito · Plan gratuito disponible · Cancela cuando quieras
        </p>

        {/* Dashboard mock */}
        <div className="mt-16 max-w-3xl mx-auto">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
            {/* Topbar mock */}
            <div className="bg-[#111113] border-b border-border px-4 py-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/70" />
              <div className="flex-1 mx-4 bg-[#1a1a24] rounded-md h-5 max-w-xs" />
            </div>
            {/* Body mock */}
            <div className="flex h-52">
              {/* Sidebar mock */}
              <div className="w-44 bg-[#111113] border-r border-border p-3 space-y-1.5 shrink-0">
                {["Dashboard","Unidades","Finanzas","PQRS","Mensajería","Contabilidad"].map((item, i) => (
                  <div key={item} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${i === 0 ? "bg-primary text-white font-medium" : "text-muted-foreground"}`}>
                    <div className={`w-3 h-3 rounded ${i === 0 ? "bg-white/30" : "bg-muted"}`} />
                    {item}
                  </div>
                ))}
              </div>
              {/* Main content mock */}
              <div className="flex-1 p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[["$12.4M","Facturado"],["$9.8M","Recaudado"],["3","PQRS abiertos"],["94%","Recaudo"]].map(([v,l]) => (
                    <div key={l} className="bg-background border border-border rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">{l}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-background border border-border rounded-lg p-2.5 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Últimos movimientos</span><span>Ver todos →</span>
                  </div>
                  {[["Apto 301","Cuota Junio","$320.000","pagado"],["Apto 104","Cuota Junio","$320.000","pendiente"],["Apto 208","Agua","$85.000","pagado"]].map(([u,c,m,s]) => (
                    <div key={u} className="flex items-center gap-2 text-[10px]">
                      <div className="w-5 h-5 rounded bg-primary/20 shrink-0" />
                      <span className="text-muted-foreground w-14 shrink-0">{u}</span>
                      <span className="text-foreground flex-1">{c}</span>
                      <span className="font-mono text-foreground">{m}</span>
                      <span className={`px-1.5 rounded-full text-[9px] font-medium ${s === "pagado" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F59E0B]/10 text-[#F59E0B]"}`}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-3">
            Vista previa del panel de administración
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
function Stats() {
  return (
    <section className="border-y border-border bg-card/30">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-foreground tabular-nums">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Módulos ───────────────────────────────────────────────────────────────────
function Modules() {
  return (
    <section id="modulos" className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <div className="inline-block bg-primary/10 text-primary text-xs px-3 py-1 rounded-full border border-primary/20 mb-4">
          Módulos disponibles
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">
          Todo lo que necesita tu copropiedad
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Activa solo los módulos que necesitas. Cada plan incluye un conjunto diferente —
          sin sorpresas, sin letra pequeña.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((mod) => (
          <div
            key={mod.name}
            className={`bg-card border ${mod.border} rounded-xl p-5 hover:border-primary/40 transition-all hover:-translate-y-0.5 duration-200`}
          >
            <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center mb-4`}>
              <mod.icon className={`w-5 h-5 ${mod.color}`} />
            </div>
            <h3 className="font-semibold text-foreground mb-2">{mod.name}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Cómo funciona ─────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-card/20 border-y border-border">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <div className="inline-block bg-[#22D3EE]/10 text-[#22D3EE] text-xs px-3 py-1 rounded-full border border-[#22D3EE]/20 mb-4">
            Cómo funciona
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3">
            En tres pasos ya estás operando
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Sin instalaciones, sin servidores propios. Empieza hoy mismo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.step} className="relative flex flex-col items-center text-center">
              {/* Connector */}
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="absolute top-8 left-1/2 w-full h-px bg-border hidden md:block" />
              )}
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-5 shadow-md">
                <step.icon className="w-7 h-7 text-primary" />
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Precios ───────────────────────────────────────────────────────────────────
function Pricing() {
  return (
    <section id="precios" className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <div className="inline-block bg-[#10B981]/10 text-[#10B981] text-xs px-3 py-1 rounded-full border border-[#10B981]/20 mb-4">
          Precios claros
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">
          El plan correcto para cada edificio
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Empieza gratis. Crece cuando lo necesites. Sin contratos anuales.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.highlight
                ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-lg shadow-primary/10"
                : "border-border bg-card"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-0.5 rounded-full bg-primary text-white whitespace-nowrap">
                {plan.badge}
              </span>
            )}

            <div className="mb-5">
              <p className="font-bold text-foreground text-lg">{plan.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>
            </div>

            <div className="mb-6">
              {plan.priceUSD === 0 ? (
                <p className="text-4xl font-extrabold text-foreground">Gratis</p>
              ) : (
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-foreground">${plan.priceUSD}</span>
                  <span className="text-muted-foreground text-sm mb-1.5"> USD/mes</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {plan.maxUnits ? `Hasta ${plan.maxUnits} unidades` : "Unidades ilimitadas"}
              </p>
            </div>

            <ul className="space-y-2.5 flex-1 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={plan.priceUSD === 0 ? "/sign-up" : "/sign-up"}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors ${
                plan.highlight
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-muted text-foreground hover:bg-muted/80 border border-border"
              }`}
            >
              {plan.priceUSD === 0 ? "Empezar gratis" : "Solicitar acceso"}
            </Link>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">
        Todos los precios en USD. Facturación mensual. Cancela en cualquier momento.
      </p>
    </section>
  );
}

// ─── Trust ──────────────────────────────────────────────────────────────────────
function Trust() {
  return (
    <section className="border-y border-border bg-card/20">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-8">
          Construido con tecnología de clase mundial
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10 opacity-50">
          {["Next.js 16","Clerk Auth","Turso DB","Drizzle ORM","Stripe","ExcelJS"].map((t) => (
            <span key={t} className="text-sm font-semibold text-foreground font-mono">{t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA final ─────────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-24">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-card to-[#22D3EE]/10 border border-primary/30 rounded-3xl p-12 text-center">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/20 rounded-full blur-[60px]" />
        <div className="relative z-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">
            Únete hoy
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Moderniza tu copropiedad ahora
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8 text-sm">
            Empieza con el plan gratuito. Sin tarjeta de crédito requerida.
            Migra tus datos existentes con ayuda de nuestro equipo.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              Empezar gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="mailto:soporte@phos.com.co"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Hablar con ventas →
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />Setup en minutos</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />Soporte en español</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />Datos en Colombia</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-border bg-card/20">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-foreground text-sm">PH<span className="text-primary">OS</span></span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Plataforma de gestión para copropiedades colombianas. Multi-tenant, segura y escalable.
            </p>
          </div>
          {/* Links */}
          {[
            { title: "Producto", links: [["Módulos","#modulos"],["Precios","#precios"],["Cómo funciona","#como-funciona"]] },
            { title: "Recursos",  links: [["Documentación","#"],["Soporte","#"],["Changelog","#"]] },
            { title: "Legal",     links: [["Privacidad","#"],["Términos","#"],["Cookies","#"]] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© 2026 Propiedad Horizontal OS · Construido para Colombia 🇨🇴</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              Todos los sistemas operativos
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Stats />
      <Modules />
      <HowItWorks />
      <Pricing />
      <Trust />
      <CTABanner />
      <Footer />
    </div>
  );
}
