import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Genera Solutions SAS · Sistema Operativo Solar";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function OpenGraphImage() {
  return renderOgImage({
    kicker: "Genera Solutions SAS",
    title: "Sistema Operativo Solar",
    subtitle: "Cotizador EPC · visitas técnicas · inteligencia solar",
  });
}
