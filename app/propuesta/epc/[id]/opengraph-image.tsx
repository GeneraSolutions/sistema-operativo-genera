import { getProposalServer } from "@/lib/proposal-server";
import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Cotización EPC · Genera Solutions SAS";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function QuoteOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposal = await getProposalServer(id);
  if (!proposal) {
    return renderOgImage({
      kicker: "Genera Solutions SAS",
      title: "Cotización EPC",
      subtitle: "Propuesta comercial solar",
    });
  }
  return renderOgImage({
    kicker: "Cotización EPC · Genera Solutions",
    title: proposal.clientName || "Propuesta solar",
    subtitle: `${proposal.systemKwp} kWp · ${proposal.clientCity}`,
  });
}
