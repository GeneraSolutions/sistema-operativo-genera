import type { Metadata } from "next";
import { OS_LOOK_BOOT } from "@/lib/os-look";
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "512x512" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-look="operativo">
      <body>
        <script dangerouslySetInnerHTML={{ __html: OS_LOOK_BOOT }} />
        {children}
      </body>
    </html>
  );
}
