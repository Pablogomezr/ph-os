import { requireAccesoPanelPagina } from "@/lib/auth/helpers";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import OperadoresClient from "./OperadoresClient";

export default async function OperadoresPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireAccesoPanelPagina(slug);
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  const operadores = await db
    .select()
    .from(tenantSchema.users)
    .where(eq(tenantSchema.users.role, "operator"))
    .orderBy(tenantSchema.users.name);

  return (
    <div className="p-6 space-y-5">
      <OperadoresClient slug={slug} operadores={operadores} />
    </div>
  );
}
