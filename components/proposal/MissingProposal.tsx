import Link from "next/link";

export function MissingProposal() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4efe4] px-6 text-center text-[#4d5c55]">
      <p className="text-lg font-semibold text-[#12241c]">No encontramos esta propuesta.</p>
      <p className="max-w-md text-sm">
        El enlace comercial se publica en el servidor al generarlo. Si acaba de
        copiarlo y esto aparece, vuelva a emitir el enlace desde el cotizador.
      </p>
      <Link
        href="/cotizador"
        className="rounded-lg bg-[#0f2a1f] px-4 py-2 text-sm font-semibold text-white"
      >
        Ir al cotizador
      </Link>
    </div>
  );
}
