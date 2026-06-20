import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.phos.app',
  appName: 'PH OS',
  webDir: 'www',
  // La app no se empaqueta como sitio estático: se carga directamente la
  // versión en producción (Next.js con SSR, Server Actions, auth de Clerk).
  // Esto evita duplicar build/deploy — cualquier cambio en Vercel se refleja
  // automáticamente en la app nativa sin recompilar nada.
  server: {
    url: 'https://ph-os-build.vercel.app',
    cleartext: false,
    // Clerk hace llamadas/redirecciones puntuales a su Frontend API
    // (*.clerk.accounts.dev) durante el login — se permite navegar ahí
    // sin salir de la experiencia de la app nativa.
    allowNavigation: ['*.clerk.accounts.dev'],
  },
};

export default config;
