import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/precios",
  "/offline",
  "/manifest.json",     // PWA manifest
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/export/(.*)",   // Export route handlers (auth checked inside)
  "/api/whatsapp/webhook", // Meta llama esta ruta sin sesión de Clerk — verificación propia (VERIFY_TOKEN)
  // Portal residentes: auth manejada en layout + lib/resident-auth
  // No se incluye aquí — la protección de Clerk continúa activa
]);

const isSuperadminRoute = createRouteMatcher([
  "/superadmin(.*)",
  "/api/superadmin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Rutas públicas — sin auth
  if (isPublicRoute(req)) return NextResponse.next();

  // Rutas superadmin — verificar en el handler, no aquí
  // Solo proteger con Clerk auth
  const { userId } = await auth();

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
