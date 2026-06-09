import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://phos.com.co"
  ),
  title: {
    default:  "Propiedad Horizontal OS",
    template: "%s | PHOS",
  },
  description:
    "Plataforma SaaS para administradores de propiedades horizontales en Colombia. " +
    "Finanzas, energía, mantenimiento, PQRS y exportación contable en un solo lugar.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable:          true,
    statusBarStyle:   "black-translucent",
    title:            "PHOS",
    startupImage:     [{ url: "/icons/apple-touch-icon.png" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    type:        "website",
    locale:      "es_CO",
    url:         "https://phos.com.co",
    siteName:    "Propiedad Horizontal OS",
    title:       "Propiedad Horizontal OS",
    description: "Gestiona tu copropiedad desde cualquier parte del mundo",
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512, alt: "PHOS" }],
  },
  twitter: {
    card:        "summary",
    title:       "Propiedad Horizontal OS",
    description: "Gestiona tu copropiedad desde cualquier parte del mundo",
    images:      ["/icons/icon-512x512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32",  type: "image/png" },
      { url: "/icons/icon-192x192.png",  sizes: "192x192",type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/icon-512x512-maskable.png", color: "#6366F1" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor:        [{ color: "#6366F1" }],
  width:             "device-width",
  initialScale:      1,
  maximumScale:      1,
  userScalable:      false,
  viewportFit:       "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="es"
        className={`${inter.variable} ${jetbrainsMono.variable} dark`}
        suppressHydrationWarning
      >
        <body className="min-h-screen bg-background text-foreground font-[var(--font-inter)] antialiased">
          {children}
          <Toaster richColors theme="dark" position="top-right" />
          <PwaRegister />
        </body>
      </html>
    </ClerkProvider>
  );
}
