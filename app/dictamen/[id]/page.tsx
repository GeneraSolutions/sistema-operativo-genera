import { PrintBar } from "@/components/informes/PrintBar";
import { RulingDocument } from "@/components/informes/RulingDocument";
import { getSharedRuling } from "@/lib/report-share-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharedRulingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ruling = await getSharedRuling(id);
  if (!ruling) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4efe4] px-6 text-center">
        <p className="text-lg font-semibold text-[#12241c]">
          No encontramos este dictamen.
        </p>
        <p className="max-w-md text-sm text-[#4d5c55]">
          El enlace se publica al pulsar Compartir enlace en Dictamen
          fotográfico.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe4] text-[#12241c]">
      <PrintBar title="Dictamen fotográfico Genera Solutions SAS" />
      <main className="py-6">
        <RulingDocument ruling={ruling} />
      </main>
    </div>
  );
}
