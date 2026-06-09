/**
 * Genera los iconos PNG para el PWA manifest de PHOS.
 * Usa sharp (ya instalado como dependencia de Next.js).
 *
 * Run: node scripts/gen-icons.mjs
 */

import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/icons");
mkdirSync(OUT, { recursive: true });

// ─── SVG del icono ─────────────────────────────────────────────────────────────
// Fondo indigo redondeado + letras "PH" en blanco
function makeSvg(size) {
  const radius  = Math.round(size * 0.22);   // radio del rectángulo
  const cx      = size / 2;
  const cy      = size / 2;
  // Escala de fuente proporcional al tamaño
  const fs      = Math.round(size * 0.40);
  const fsSmall = Math.round(size * 0.18);

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Fondo indigo -->
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#6366F1"/>
  <!-- Gradiente sutil -->
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#g)" opacity="0.5"/>
  <!-- Texto PH -->
  <text
    x="${cx}" y="${cy - size * 0.04}"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="800"
    font-size="${fs}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="-2"
  >PH</text>
  <!-- Tagline OS en cyan -->
  <text
    x="${cx}" y="${cy + size * 0.26}"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="600"
    font-size="${fsSmall}"
    fill="#22D3EE"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="4"
  >OS</text>
</svg>`;
}

// ─── Versión maskable (sin radius — fondo llena todo el borde) ─────────────────
function makeMaskableSvg(size) {
  const cx      = size / 2;
  const cy      = size / 2;
  const fs      = Math.round(size * 0.36);
  const fsSmall = Math.round(size * 0.16);

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gm" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#4338CA"/>
    </linearGradient>
  </defs>
  <!-- Fondo sólido lleno (maskable — sin borde redondeado) -->
  <rect width="${size}" height="${size}" fill="url(#gm)"/>
  <!-- Texto centrado dentro del safe zone (80%) -->
  <text
    x="${cx}" y="${cy - size * 0.04}"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="800"
    font-size="${fs}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="-2"
  >PH</text>
  <text
    x="${cx}" y="${cy + size * 0.24}"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="600"
    font-size="${fsSmall}"
    fill="#22D3EE"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="4"
  >OS</text>
</svg>`;
}

// ─── Generar archivos ──────────────────────────────────────────────────────────
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

console.log("🎨 Generating PWA icons...");

for (const size of SIZES) {
  // Icono normal
  await sharp(Buffer.from(makeSvg(size)))
    .png()
    .toFile(join(OUT, `icon-${size}x${size}.png`));
  console.log(`  ✓ icon-${size}x${size}.png`);
}

// Iconos maskable (192 y 512)
for (const size of [192, 512]) {
  await sharp(Buffer.from(makeMaskableSvg(size)))
    .png()
    .toFile(join(OUT, `icon-${size}x${size}-maskable.png`));
  console.log(`  ✓ icon-${size}x${size}-maskable.png`);
}

// Apple touch icon (180x180, sin radius visible — iOS lo aplica)
await sharp(Buffer.from(makeSvg(180)))
  .png()
  .toFile(join(OUT, "apple-touch-icon.png"));
console.log("  ✓ apple-touch-icon.png");

// Favicon 32x32
await sharp(Buffer.from(makeSvg(32)))
  .png()
  .toFile(join(OUT, "favicon-32x32.png"));
console.log("  ✓ favicon-32x32.png");

console.log(`\n✅ ${SIZES.length + 4} iconos generados en public/icons/`);
