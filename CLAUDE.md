# Propiedad Horizontal OS

SaaS multi-inquilino para administración de copropiedades en Colombia. Cada
edificio tiene su propia base de datos Turso, completamente aislada.

**En producción:** Edificio Camacol, en el proyecto de Vercel `ph-os-build`.

> Este archivo describe el código **como está hoy**, no como se planeó. Si
> encuentras algo que no coincide con la realidad, corrígelo aquí antes de
> escribir código basado en ello.

## Comandos

El repo usa **npm** (hay `package-lock.json`). No pnpm.

- `npm run dev` — servidor de desarrollo en localhost:3000
- `npm run build` — build de producción; corre también el typecheck
- `npm run lint` — ESLint
- `npm test` — tests con el runner nativo de Node (`node:test` + `tsx`). No hay Vitest ni Jest.
- `npm run db:generate` — genera migración del esquema **central** → `drizzle/migrations/`
- `npm run db:generate:tenant` — genera migración del esquema de **inquilino** → `drizzle/tenant-migrations/`
- `npm run db:migrate:tenant` — aplica migraciones de inquilino a la base de cada edificio
- `npm run db:studio` — Drizzle Studio

**Cuidado con `db:generate`.** Sin sufijo apunta al esquema central. Para las
tablas de edificio —que son casi todas— es `db:generate:tenant`.

### Migrar la base de un edificio

`scripts/migrate-tenant.mjs` lee los edificios de la base central y aplica lo
pendiente a cada uno. **Por defecto es simulacro y no escribe nada.**

```
vercel env pull .env.local --environment=production   # trae TURSO_CENTRAL_*
node scripts/migrate-tenant.mjs                        # simulacro
node scripts/migrate-tenant.mjs --slug=<edificio>      # simulacro, uno solo
node scripts/migrate-tenant.mjs --apply                # aplica de verdad
```

Lleva su propio registro en una tabla `__migraciones` dentro de cada base de
edificio. Una base que ya existía antes de ese registro se pone al día con
`--baseline=<tag>`, que marca lo anterior como aplicado sin ejecutarlo.

Al terminar, **devuelve `.env.local` a desarrollo** con `vercel env pull
.env.local` a secas. Si no, tu servidor local escribe en producción.

## Stack real

Next.js **16.2.7** (App Router, Turbopack) · TypeScript · Tailwind v4 ·
shadcn/ui · Clerk · Turso + Drizzle ORM · **Vercel Blob** · Stripe ·
API de Claude (OCR de comprobantes) · WhatsApp Cloud API

Están en `package.json` pero **no se usan en `src/`**: `resend`, `zod`,
`@aws-sdk/client-s3` (R2), `tesseract.js`, `exceljs` fuera de la ruta de export.
No asumas que hay validación con Zod ni envío de correo: no la hay todavía.

## Arquitectura

### Multi-inquilino
- **Base central** (`ph-os-central` en Turso): tabla `buildings` con
  `turso_db_url`, `turso_auth_token` y `whatsapp_phone_id` por edificio.
- **Base por edificio**: mismo esquema, datos aislados.
- `getTenantDb(slug)` en `src/lib/db/tenant.ts` — **siempre** por aquí. Nunca
  hardcodear una conexión de edificio.
- Nunca exponer `turso_db_url` ni `turso_auth_token` al cliente.

**Consecuencia crítica:** la autorización vive en el **código de aplicación**,
no en la base. No hay RLS. Cualquier proceso que hable con Turso sin pasar por
estos helpers no tiene autorización de ningún tipo.

### Estructura de carpetas
- `src/app/(marketing)/` — landing, precios, privacidad
- `src/app/(building)/e/[slug]/` — **panel de administración del edificio**
- `src/app/r/[slug]/` — portal del residente
- `src/app/op/[slug]/` — portal del operario (lecturas de energía)
- `src/app/(superadmin)/superadmin/` — panel del dueño del SaaS
- `src/app/api/whatsapp/webhook/` — webhook de WhatsApp
- `src/app/api/cron/` — rutas de Vercel Cron (agentes)
- `src/lib/agents/` — agentes: cola, bitácora y lógica de A1
- `src/lib/cartera/saldo.ts` — **fuente única de verdad del saldo**
- `src/lib/db/` — conexiones y esquemas

Estas carpetas existen pero están **vacías**, son restos de un diseño anterior:
`src/app/(app)/`, `src/lib/exports/`, `src/lib/messaging/`, `src/lib/r2/`,
`src/lib/stripe/`. No hay rutas `api/[buildingSlug]/`.

### Mutaciones
Van por **Server Actions** (12 archivos `actions.ts`), no por API routes. Las
únicas rutas de API son las de webhooks, cron, export y Stripe.

### Los dos sistemas de roles
Esto confunde. Son dos cosas distintas y no se mezclan:

1. **Rol de organización de Clerk** → `getUserRole(slug)` en
   `src/lib/auth/helpers.ts`. Devuelve `superadmin | admin | technician |
   resident`. Controla el acceso al panel de administración.
2. **Rol del residente en la base del edificio** → columna `users.role`.
   Valores: `resident` (Propietario), `tenant` (Arrendatario), `observer`
   (Observador, solo lectura), `admin`, `technician`. Se consulta con
   `isReadOnlyRole()` de `src/lib/roles.ts`, un módulo sin dependencias
   pensado para poder importarse desde el webhook, que no debe cargar Clerk.

El **Observador nunca modifica nada** y nunca recibe cobros. Es regla de
producto, y está cubierta por tests en `src/lib/agents/a1-cartera/`.

### Módulos
`buildings.active_modules` (JSON) en la base central, verificado con
`isModuleActive()` de `src/lib/modules/checker.ts`. Disponibles: `base`,
`finanzas`, `energia`, `mantenimiento`, `pqrs`, `contabilidad`, `mensajeria`.

## Dinero

**El esquema guarda el dinero en `real` (punto flotante)**, no en centavos:
`charges.amount`, `payments.amount`, `bank_movements.amount`. Es una decisión
heredada, no una recomendación. Las tablas nuevas usan **pesos enteros**.

`src/lib/cartera/saldo.ts` es la **única** definición válida de saldo y de
estado vencido. La consumen el panel de administración, el portal del residente
y el agente de cartera. Antes cada uno calculaba lo suyo y mostraban cifras
distintas para la misma unidad.

- El estado `overdue` **se deriva** de `dueDate`; nunca se escribe en la base.
- Se restan **todos** los pagos registrados, verificados contra el banco o no:
  a quien ya reportó su pago no se le cobra.
- Formato de moneda: `formatearCOP()` del mismo módulo.

## Agentes

`src/lib/agents/`. El primero es **A1 — Cartera** (avisos de mora los días 6,
16 y 26). Corren dentro de esta app Next.js, invocados por Vercel Cron; no hay
orquestador externo, precisamente porque la autorización vive en el código.

- `shared/queue.ts` — cola con reintentos y backoff. Vercel **no reintenta** un
  cron fallido y **puede invocar el mismo más de una vez**: la cola resuelve lo
  primero y la clave de idempotencia lo segundo.
- `shared/log.ts` — bitácora. **Toda** ejecución deja fila, incluidas las
  omitidas, con su motivo. Es la evidencia ante el consejo de administración.
- `a1-cartera/` — encolado con circuit breaker del 40%, y ejecución con los
  ocho guardarraíles.

Reglas al tocar un agente:
1. El saldo **se relee de la base en el momento de enviar**, jamás del payload.
2. El payload de un job lleva **solo ids**, nunca montos.
3. Los envíos usan **plantillas aprobadas de Meta**, nunca texto libre.
4. Si un guardarraíl bloquea algo, **igual se escribe en `agent_log`**.

## Seguridad

- **Webhook de WhatsApp:** cada POST se autentica con la firma HMAC-SHA256 de
  Meta (`X-Hub-Signature-256`) sobre el **cuerpo crudo**, comparada de forma
  timing-safe. Ver `src/lib/whatsapp/signature.ts`. El `WHATSAPP_VERIFY_TOKEN`
  solo cubre el handshake `GET`; **no autentica ni un solo mensaje**.
- **Rutas de cron:** validan `CRON_SECRET` con comparación timing-safe
  (`src/lib/cron-auth.ts`). Están en `isPublicRoute` porque no hay sesión de
  Clerk detrás de un cron, así que esa función es la única barrera.
- Ambas **fallan cerrado**: sin el secreto configurado, no pasa nadie.

## Deuda conocida

No la arregles de paso; está anotada para que no te sorprenda.

- **`audit_logs` no se escribe nunca.** La tabla existe, el helper `logAction`
  que mencionaba la versión anterior de este archivo **no existe**, y ninguna
  mutación registra nada. Sigue siendo lo correcto por hacer.
- **`requireRole()` está definido pero no se usa en ninguna parte.** Además su
  jerarquía no incluye `observer`: un rol fuera de la lista da `indexOf === -1`
  y **pasa cualquier verificación**. Revisar antes de empezar a usarlo.
- **Drift de esquema.** Se usó `db:push` en vez de `generate` + `migrate` al
  menos dos veces: `whatsapp_phone_id` en la central y `payment_references` en
  el inquilino. Por eso `db:migrate:central` hoy fallaría.
- **Sin validación de entrada.** Zod está instalado y no se usa.
- El portal del residente y el panel llevaban meses mostrando saldos distintos.
  Ya está corregido, pero es el tipo de divergencia que hay que vigilar.

## Reglas al escribir código

1. TypeScript estricto. Cero `any`. Tipos inferidos de Drizzle con
   `typeof schema.$inferSelect`.
2. Alias `@/` para imports. Nunca `../../..`.
3. Server Components por defecto; `"use client"` solo con interactividad real.
4. Todo query de edificio pasa por `getTenantDb(slug)`.
5. Todo saldo o estado de cargo sale de `src/lib/cartera/saldo.ts`.
6. Los `audit_logs` son **inmutables**: solo INSERT, jamás UPDATE ni DELETE.
7. Móvil primero: 375px y de ahí hacia arriba.
8. Verificar el rol en cada Server Action. El middleware no basta.

## Diseño

Oscuro, estilo fintech. Fondo `#09090B`, tarjetas `#18181B`, bordes `#3F3F46`,
primario `#6366F1`, acento `#22D3EE`. Éxito `#10B981`, advertencia `#F59E0B`,
error `#EF4444`.

Radios: 6px inputs, 8px botones, 12px tarjetas, 16px modales. Espaciado en
múltiplos de 4. Sidebar 240px en escritorio, drawer en móvil.

Valores monetarios: alineados a la derecha, tabulares, siempre con
`formatearCOP()`.

## Variables de entorno

Viven en Vercel, proyecto **`ph-os-build`**. Se traen con `vercel env pull`.

| Variable | Para qué |
|---|---|
| `TURSO_CENTRAL_URL` / `TURSO_CENTRAL_AUTH_TOKEN` | Base central |
| `TURSO_API_TOKEN` / `TURSO_ORG` | Crear bases de edificio |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk |
| `SUPERADMIN_USER_ID` | Acceso de superadministrador |
| `WHATSAPP_TOKEN` | Token del System User de Meta |
| `WHATSAPP_VERIFY_TOKEN` | Solo el handshake GET del webhook |
| `WHATSAPP_APP_SECRET` | **Firma de cada POST entrante.** Sin ella el webhook rechaza todo |
| `CRON_SECRET` | Autentica las rutas de cron. Se crea a mano; Vercel no la inyecta |
| `ANTHROPIC_API_KEY` | OCR de comprobantes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (store `ph-os-documentos`) |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Suscripciones |

Varias están marcadas **Sensitive**: su valor no se puede volver a leer, ni por
la CLI ni por el panel. Si necesitas una, consíguela de su origen, no de Vercel.
