import { redirect } from "next/navigation";

export default async function OperatorRoot({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/op/${slug}/lecturas`);
}
