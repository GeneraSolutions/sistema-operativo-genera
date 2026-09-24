import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Operativo Solar | Genera Solutions SAS",
  description:
    "Cotizador paramétrico, catálogo de equipos e inteligencia de ingeniería solar para Colombia.",
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
