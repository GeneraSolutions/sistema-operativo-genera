import type { Metadata } from "next";
import VCardClient from "./vcard-client";

export const metadata: Metadata = {
  title: {
    absolute: "vCard Digital | Genera Solutions SAS",
  },
  description:
    "Tarjeta digital de Genera Solutions SAS. Energía solar, proyectos fotovoltaicos y estructuración PPA.",
  openGraph: {
    title: "vCard Digital | Genera Solutions SAS",
    description:
      "Tarjeta digital de Genera Solutions SAS. Energía solar, proyectos fotovoltaicos y estructuración PPA.",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function VCardPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  return <VCardClient params={params} />;
}
