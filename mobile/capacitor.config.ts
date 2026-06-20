import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.phos.app',
  appName: 'PH OS',
  webDir: 'www',
  // El login de Clerk (instancia de desarrollo, *.clerk.accounts.dev) no
  // mantiene sesión de forma confiable dentro del WebView embebido de
  // Android — su sincronización de sesión cruza de dominio y el WebView la
  // bloquea pese a habilitar cookies de terceros. La app por eso ya no
  // carga el sitio embebido (server.url); en su lugar www/index.html abre
  // el sitio en una Chrome Custom Tab (navegador del sistema), donde el
  // login ya funciona de forma comprobada.
};

export default config;
