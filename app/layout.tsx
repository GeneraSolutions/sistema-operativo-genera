import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaSetup } from "@/components/PwaSetup";
import { OS_LOOK_BOOT } from "@/lib/os-look";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const title = "Sistema Operativo Solar | Genera Solutions SAS";
const description =
  "Cotizador paramétrico, catálogo de equipos e inteligencia de ingeniería solar para Colombia.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title,
  description,
  applicationName: "Sistema Operativo Solar",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Genera OS",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "es_CO",
    siteName: "Genera Solutions SAS",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
      { url: "/apple-icon.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f2a1f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-look="moderno"
      data-sidebar="amplio"
      className={inter.variable}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: OS_LOOK_BOOT }} />
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
