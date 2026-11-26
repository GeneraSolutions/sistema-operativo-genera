import { PrintBar } from "@/components/informes/PrintBar";
import { AcceptBox } from "@/components/solarwin/AcceptBox";
import { AutoPrint } from "@/components/solarwin/AutoPrint";
import { StatementDocument } from "@/components/solarwin/StatementDocument";
import { getSolarwinStatement } from "@/lib/solarwin-share-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EstadoCuentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const statement = await getSolarwinStatement(id);
  if (!statement) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4efe4] px-6 text-center">
        <p className="text-lg font-semibold text-[#12241c]">
          No encontramos este estado de cuenta.
        </p>
        <p className="max-w-md text-sm text-[#4d5c55]">
          Genere un nuevo enlace desde Solar win → Gastos.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe4] text-[#12241c]">
      <PrintBar title="Estado de cuenta · Solar win" />
      <AutoPrint />
      <main className="px-4 py-8 sm:px-6">
        <StatementDocument statement={statement} />
        <AcceptBox id={statement.id} initial={statement.acceptance ?? null} />
      </main>
    </div>
  );
}
