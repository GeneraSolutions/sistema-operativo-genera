import { PrintBar } from "@/components/informes/PrintBar";
import { ReportDocument } from "@/components/informes/ReportDocument";
import { getSharedReport } from "@/lib/report-share-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getSharedReport(id);
  if (!report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4efe4] px-6 text-center">
        <p className="text-lg font-semibold text-[#12241c]">
          No encontramos este informe.
        </p>
        <p className="max-w-md text-sm text-[#4d5c55]">
          El enlace se publica al pulsar Compartir enlace en Informes. Vuelva a
          emitirlo si acaba de copiarlo.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe4] text-[#12241c]">
      <PrintBar title="Informe técnico Genera Solutions" />
      <main className="py-6">
        <ReportDocument report={report} />
      </main>
    </div>
  );
}
