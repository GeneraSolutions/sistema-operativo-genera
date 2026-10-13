import Link from "next/link";

export function MissingProposal() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070b16] px-6 text-center text-[#c5d4ea]">
      <p className="text-lg text-white">No encontramos esta propuesta.</p>
      <p className="max-w-md text-sm">
        El enlace comercial se publica en el servidor al generarlo. Si acaba de
        copiarlo y esto aparece, vuelva a emitir el enlace desde el cotizador.
      </p>
      <Link
        href="/cotizador"
        className="rounded-lg bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#041018]"
      >
        Ir al cotizador
      </Link>
    </div>
  );
}
