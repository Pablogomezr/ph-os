# Propiedad Horizontal OS

SaaS multi-tenant para gestión administrativa de copropiedades en Colombia.
Cada edificio tiene su propia base de datos Turso completamente aislada.

## Comandos

- `pnpm dev` — Servidor de desarrollo (localhost:3000)
- `pnpm build` — Build de producción
- `pnpm lint` — ESLint
- `pnpm test` — Vitest unit tests
- `pnpm db:migrate:central` — Migrar DB central (superadmin)
- `pnpm db:migrate:tenant <slug>` — Migrar DB de un edificio específico
- `pnpm db:studio` — Drizzle Studio (explorador de DB)

## Tech Stack

Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Clerk + Turso (Drizzle ORM) + Vercel + Resend + Cloudflare R2 + Stripe

## Arquitectura

### Multi-tenancy
- **DB central** (Turso): tabla `buildings` con `turso_db_url` y `turso_auth_token` por edificio
- **DB por edificio** (Turso): schema idéntico, datos completamente aislados
- `getTenantDb(buildingSlug)` en `src/lib/db/tenant.ts` — siempre usar esta función para queries de edificio
- NUNCA hardcodear conexiones a DB de edificio — siempre resolverla por slug

### Auth Flow
1. Clerk middleware protege todas las rutas excepto `/`, `/precios`, `/sign-in`, `/sign-up`
2. Clerk Organizations = Edificios — cada edificio es una Org en Clerk
3. `getUserRole(userId, buildingSlug)` retorna `admin | resident | technician`
4. Superadmin: verificar `userId === process.env.SUPERADMIN_USER_ID`

### Directory Structure
- `src/app/(marketing)/` — Rutas públicas (landing, precios)
- `src/app/(superadmin)/superadmin/` — Panel del dueño del SaaS
- `src/app/(app)/[buildingSlug]/` — App por edificio — protegida por Clerk
- `src/app/api/[buildingSlug]/` — API routes por edificio
- `src/components/app/` — Componentes de la app (sidebar, forms, widgets)
- `src/lib/db/` — Conexiones DB (tenant.ts + superadmin.ts + schemas)
- `src/lib/exports/` — Generadores World Office, Siigo, Excel, CSV
- `src/lib/messaging/` — Helpers SSE para mensajería en tiempo real

### Data Flow
- Server Components → `getTenantDb(slug)` → query Drizzle → render directo
- Mutaciones → TanStack Query mutation → `fetch('/api/[slug]/...')` → API Route → Drizzle → audit_log
- Tiempo real → cliente conecta SSE `/api/[slug]/messages/stream` → `useMessages()` hook

### Módulos
Los módulos activos se guardan en `buildings.active_modules` (JSON array) en DB central.
`src/lib/modules/checker.ts` → `isModuleActive(slug, module)` para verificar.
`src/components/app/layout/module-guard.tsx` → bloquea rutas de módulos inactivos.
Módulos disponibles: `base`, `finanzas`, `energia`, `mantenimiento`, `pqrs`, `contabilidad`, `mensajeria`

## Code Organization Rules

1. **Un componente por archivo.** Máximo 300 líneas. Si es más largo, extraer sub-componentes.
2. **Alias `@/` para imports.** Nunca rutas relativas con `../../..`
3. **Server Components por defecto.** Solo `"use client"` cuando hay interactividad (forms, charts, SSE).
4. **Todos los queries de DB van por `getTenantDb(slug)`.** Nunca conexión directa hardcodeada.
5. **Toda mutación escribe en `audit_logs`.** Usar helper `logAction(db, userId, action, entityType, entityId)`.
6. **Formatear COP siempre así:** `new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount)`
7. **Validar inputs con Zod** en todas las API routes antes de tocar la DB.
8. **No exponer `turso_db_url` ni `turso_auth_token` al cliente nunca.** Solo server-side.

## Design System

### Colores (Dark Fintech)
- Background: `#09090B` (--background)
- Surface/Cards: `#18181B` (--card)
- Surface Elevated: `#27272A`
- Border: `#3F3F46`
- Primary (Indigo): `#6366F1`
- Accent (Cyan): `#22D3EE`
- Success: `#10B981`
- Warning: `#F59E0B`
- Destructive: `#EF4444`
- Text Primary: `#FAFAFA`
- Text Secondary: `#A1A1AA`

### Typography
- Fuente UI: Inter (headings bold, body regular)
- Fuente datos financieros: JetBrains Mono (siempre para COP y kWh)

### Style
- Border radius: 6px inputs, 8px botones, 12px cards, 16px modales
- Espaciado base: 4px (usar múltiplos de 4)
- Sidebar: 240px desktop, drawer móvil
- Badges de estado: `paid=emerald`, `pending=amber`, `overdue=red`, `in_review=cyan`
- Valores monetarios: siempre alineados derecha, font-mono, formato COP

## Environment Variables

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `SUPERADMIN_USER_ID` | Tu Clerk userId — acceso superadmin |
| `TURSO_CENTRAL_URL` | URL DB central Turso |
| `TURSO_CENTRAL_AUTH_TOKEN` | Token DB central |
| `TURSO_API_TOKEN` | Token API Turso (crear DBs programáticamente) |
| `TURSO_ORG_NAME` | Nombre de tu organización en Turso |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Email remitente (ej: noreply@tudominio.com) |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | Nombre del bucket R2 |
| `NEXT_PUBLIC_APP_URL` | URL pública (https://tudominio.com) |

## Reglas No Negociables

1. TypeScript strict mode. Cero `any`. Inferir tipos de Drizzle con `typeof schema.$inferSelect`.
2. Nunca exponer credenciales de Turso al cliente. Siempre server-side only.
3. Toda API route valida con Zod antes de procesar. Retornar `{ error: string }` con status 400 si falla.
4. Todo cambio financiero (cargo, pago) escribe en `audit_logs`. Es obligatorio, no opcional.
5. Mobile-first: diseñar para 375px primero, luego escalar a desktop.
6. Verificar `isModuleActive()` antes de servir cualquier ruta de módulo opcional.
7. Verificar rol del usuario en cada API route. No confiar solo en el middleware de Next.js.
8. Los `audit_logs` son INMUTABLES. Solo INSERT, nunca UPDATE ni DELETE.
9. Formatear dinero siempre en COP con `Intl.NumberFormat('es-CO')`. Nunca formatear manualmente.
10. Al crear edificio nuevo: crear Turso DB + correr migraciones + crear Clerk Org ANTES de guardar en DB central.
