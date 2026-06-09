"use server";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { requireSuperadmin } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import path from "path";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // eliminar tildes
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export type CreateBuildingState = { error?: string } | null;

export async function createBuilding(
  _prevState: CreateBuildingState,
  formData: FormData
): Promise<CreateBuildingState> {
  await requireSuperadmin();

  const name    = (formData.get("name") as string)?.trim();
  const slugRaw = (formData.get("slug") as string)?.trim();
  const city    = (formData.get("city") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const nit     = (formData.get("nit") as string)?.trim() || null;
  const plan    = (formData.get("plan") as string) || "base";
  const modules = formData.getAll("modules") as string[];

  if (!name) return { error: "El nombre del edificio es requerido." };

  const slug = slugRaw ? slugRaw : slugify(name);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "El slug solo puede contener letras minúsculas, números y guiones." };
  }

  // Verificar que el slug no exista
  const db = getSuperadminDb();
  const existing = await db
    .select({ id: superadminSchema.buildings.id })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (existing) return { error: `El slug "${slug}" ya está en uso. Elige otro nombre.` };

  const activeModules = ["base", ...modules.filter((m) => m !== "base")];
  const id  = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const isDevMode = process.env.TURSO_CENTRAL_URL?.startsWith("file:");

  let tursoDbUrl: string;
  let tursoAuthToken: string;
  let clerkOrgId: string;

  if (isDevMode) {
    // ── DEV MODE: SQLite local por tenant ─────────────────────────────────────
    tursoDbUrl     = `file:./dev-tenant-${slug}.db`;
    tursoAuthToken = "local-dev-token";
    clerkOrgId     = `org_dev_${Date.now()}`;

    // Crear la DB del tenant y aplicar migraciones automáticamente
    const client = createClient({ url: tursoDbUrl, authToken: tursoAuthToken });
    const tenantDb = drizzle(client);
    try {
      await migrate(tenantDb, {
        migrationsFolder: path.join(process.cwd(), "drizzle/tenant-migrations"),
      });
    } finally {
      client.close();
    }
  } else {
    // ── PROD MODE: Turso API ───────────────────────────────────────────────────
    const apiToken = process.env.TURSO_API_TOKEN;
    const org      = process.env.TURSO_ORG;

    if (!apiToken || !org) {
      return { error: "TURSO_API_TOKEN y TURSO_ORG son requeridos en producción. Configura las variables de entorno." };
    }

    const dbName = `ph-${slug}`;
    const tursoBase = `https://api.turso.tech/v1/organizations/${org}`;
    const headers = {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    // 1. Crear DB en Turso
    const createRes = await fetch(`${tursoBase}/databases`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: dbName, group: "default" }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return { error: `Error creando DB en Turso: ${err}` };
    }
    const createData = await createRes.json() as { database: { Hostname: string } };
    const hostname = createData.database.Hostname;
    tursoDbUrl = `libsql://${hostname}`;

    // 2. Crear token de autenticación para la DB
    const tokenRes = await fetch(`${tursoBase}/databases/${dbName}/auth/tokens`, {
      method: "POST",
      headers,
      body: JSON.stringify({ authorization: "full-access" }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return { error: `Error creando token Turso: ${err}` };
    }
    const tokenData = await tokenRes.json() as { jwt: string };
    tursoAuthToken = tokenData.jwt;

    // 3. Aplicar el schema del tenant a la nueva DB
    const tenantClient = createClient({ url: tursoDbUrl, authToken: tursoAuthToken });
    const tenantDb = drizzle(tenantClient);
    try {
      await migrate(tenantDb, {
        migrationsFolder: path.join(process.cwd(), "drizzle/tenant-migrations"),
      });
    } finally {
      tenantClient.close();
    }

    // 4. Clerk org ID (placeholder — se puede vincular a Clerk Organizations más adelante)
    clerkOrgId = `org_turso_${slug}_${Date.now()}`;
  }

  // Insertar en la DB central
  await db.insert(superadminSchema.buildings).values({
    id,
    name,
    slug,
    city,
    address,
    nit,
    country: "Colombia",
    clerkOrgId,
    tursoDbUrl,
    tursoAuthToken,
    activeModules: JSON.stringify(activeModules),
    status: "active",
    plan,
    createdAt: now,
    updatedAt: now,
  });

  redirect(`/superadmin/edificios/${slug}`);
}
