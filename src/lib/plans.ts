/**
 * Definición de planes de suscripción.
 * Este archivo es seguro para importar desde Client Components.
 * NO importa Stripe ni variables de entorno secretas.
 */

export type PlanId = "base" | "profesional" | "empresarial";

export interface Plan {
  id:          PlanId;
  name:        string;
  tagline:     string;
  priceUSD:    number;
  priceLabel:  string;
  priceEnvKey: string | null; // env var que contiene el price_id de Stripe
  maxUnits:    number | null; // null = ilimitado
  features:    string[];
  highlight:   boolean;
  badge:       string | null;
}

export const PLANS: Plan[] = [
  {
    id:          "base",
    name:        "Starter",
    tagline:     "Para edificios pequeños",
    priceUSD:    0,
    priceLabel:  "Gratis",
    priceEnvKey: null,
    maxUnits:    30,
    features: [
      "Hasta 30 unidades",
      "Dashboard y reportes básicos",
      "Módulo Unidades y Residentes",
      "Módulo Finanzas (cargos y pagos)",
      "Soporte por correo",
    ],
    highlight: false,
    badge: null,
  },
  {
    id:          "profesional",
    name:        "Profesional",
    tagline:     "El más popular",
    priceUSD:    49,
    priceLabel:  "$49 USD/mes",
    priceEnvKey: "NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL",
    maxUnits:    200,
    features: [
      "Hasta 200 unidades",
      "Todo lo del plan Starter",
      "Módulo PQRS",
      "Módulo Mensajería",
      "Módulo Contabilidad (Siigo, World Office)",
      "Soporte prioritario",
    ],
    highlight: true,
    badge:    "Más popular",
  },
  {
    id:          "empresarial",
    name:        "Empresarial",
    tagline:     "Para grandes conjuntos",
    priceUSD:    99,
    priceLabel:  "$99 USD/mes",
    priceEnvKey: "NEXT_PUBLIC_STRIPE_PRICE_EMPRESARIAL",
    maxUnits:    null,
    features: [
      "Unidades ilimitadas",
      "Todo lo del plan Profesional",
      "Módulo Energía (medidores kWh)",
      "Módulo Mantenimiento (activos y tareas)",
      "SLA de soporte 24/7",
      "Onboarding personalizado",
    ],
    highlight: false,
    badge:    "Enterprise",
  },
];

export function getPlanById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Mapea un Stripe Price ID al plan correspondiente */
export function getPlanFromPriceId(
  priceId: string,
  proPriceId: string | undefined,
  enterprisePriceId: string | undefined
): PlanId {
  if (priceId === proPriceId)         return "profesional";
  if (priceId === enterprisePriceId)  return "empresarial";
  return "base";
}
