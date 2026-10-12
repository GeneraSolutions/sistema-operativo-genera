import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const title = "Sistema Operativo Solar | Genera Solutions SAS";
const description =
  "Cotizador paramétrico, catálogo de equipos e inteligencia de ingeniería solar para Colombia.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title,
  description,
  applicationName: "Sistema Operativo Solar",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
