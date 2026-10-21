export const MAX_RUT_PHOTOS = 4;

export interface ClientPartyPhoto {
  id: string;
  dataUrl: string;
  fileName?: string;
}

export type ClientIdType = "nit" | "cc" | "ce" | "ppt" | "otro";
export type ClientPersonType = "natural" | "juridica" | "";
export type ClientTaxRegime =
  | "comun"
  | "simple"
  | "no_responsable"
  | "especial"
  | "";

export interface ClientParty {
  photos: ClientPartyPhoto[];
  pdfText: string;
  legalName: string;
  tradeName: string;
  nit: string;
  dv: string;
  idType: ClientIdType;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  personType: ClientPersonType;
  regime: ClientTaxRegime;
  responsibilities: string[];
  agenteRetenedorFuente: boolean;
  agenteRetenedorIva: boolean;
  agenteRetenedorIca: boolean;
  granContribuyente: boolean;
  autorretenedor: boolean;
  responsabilidadesTexto: string;
  extras: string;
  analyzedAt: string;
}

export function emptyClientParty(): ClientParty {
  return {
    photos: [],
    pdfText: "",
    legalName: "",
    tradeName: "",
    nit: "",
    dv: "",
    idType: "nit",
    email: "",
    phone: "",
    address: "",
    city: "",
    department: "",
    personType: "",
    regime: "",
    responsibilities: [],
    agenteRetenedorFuente: false,
    agenteRetenedorIva: false,
    agenteRetenedorIca: false,
    granContribuyente: false,
    autorretenedor: false,
    responsabilidadesTexto: "",
    extras: "",
    analyzedAt: "",
  };
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value || "").toLowerCase();
  return s === "true" || s === "si" || s === "sí" || s === "1" || s === "yes";
}

const RESP_LABELS: Record<string, string> = {
  "04": "IVA",
  "05": "Agente retención IVA",
  "07": "Agente retención en la fuente",
  "08": "Informante de exógena",
  "09": "Gran contribuyente",
  "13": "Gran contribuyente",
  "14": "Informante de precios de transferencia",
  "15": "Autorretenedor",
  "23": "Agente retención ICA",
  "47": "Régimen simple",
  "48": "Impuesto unificado — simple",
};

function codesFrom(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((c) => String(c).replace(/\D/g, "").padStart(2, "0").slice(-2))
      .filter((c) => c.length === 2);
  }
  const blob = text(raw);
  if (!blob) return [];
  return [...blob.matchAll(/\b(\d{1,2})\b/g)]
    .map((m) => m[1].padStart(2, "0"))
    .filter((c, i, a) => a.indexOf(c) === i);
}

function splitNit(raw: string): { nit: string; dv: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) {
    return { nit: digits.slice(0, -1), dv: digits.slice(-1) };
  }
  if (digits.length >= 8) return { nit: digits, dv: "" };
  return { nit: digits, dv: "" };
}

export function formatNit(nit: string, dv?: string): string {
  const n = nit.replace(/\D/g, "");
  if (!n) return "";
  const grouped = n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dv ? `${grouped}-${dv}` : grouped;
}

export function displayClientName(party: ClientParty): string {
  return party.legalName || party.tradeName || "";
}

export function clientWithholdsFromParty(party: ClientParty): boolean {
  return (
    party.agenteRetenedorFuente ||
    party.agenteRetenedorIca ||
    party.autorretenedor
  );
}

export function withholdingNote(party: ClientParty): string {
  const bits: string[] = [];
  if (party.agenteRetenedorFuente) bits.push("ReteFuente");
  if (party.agenteRetenedorIca) bits.push("ReteICA");
  if (party.agenteRetenedorIva || party.granContribuyente) bits.push("ReteIVA");
  if (party.autorretenedor) bits.push("autorretenedor");
  if (!bits.length) {
    return "En el RUT no figura como agente retenedor. Factura sin retenciones en la fuente ni ICA, salvo que el cliente indique otra cosa.";
  }
  return `El RUT indica ${bits.join(", ")}. Al facturar se aplican las retenciones correspondientes.`;
}

export function compactClientParty(party?: ClientParty | null): ClientParty | undefined {
  if (!party) return undefined;
  const hasIdentity =
    party.legalName ||
    party.nit ||
    party.email ||
    party.phone ||
    party.address;
  if (!hasIdentity && !party.photos.length) return undefined;
  return {
    ...party,
    photos: [],
    pdfText: (party.pdfText || "").slice(0, 4000),
  };
}

export function normalizeClientParty(
  raw: Partial<ClientParty> | null | undefined,
  photos?: ClientPartyPhoto[]
): ClientParty {
  const base = emptyClientParty();
  const nitIn = text(raw?.nit);
  const split = splitNit(nitIn);
  const dv = text(raw?.dv) || split.dv;
  const codes = codesFrom(raw?.responsibilities ?? raw?.responsabilidadesTexto);
  const has = (code: string) => codes.includes(code);
  const agenteFuente =
    bool(raw?.agenteRetenedorFuente) || has("07");
  const agenteIva = bool(raw?.agenteRetenedorIva) || has("05");
  const agenteIca = bool(raw?.agenteRetenedorIca) || has("23");
  const gran = bool(raw?.granContribuyente) || has("09") || has("13");
  const auto = bool(raw?.autorretenedor) || has("15");
  const idTypeRaw = text(raw?.idType).toLowerCase();
  const idType: ClientIdType =
    idTypeRaw === "cc" ||
    idTypeRaw === "ce" ||
    idTypeRaw === "ppt" ||
    idTypeRaw === "otro" ||
    idTypeRaw === "nit"
      ? idTypeRaw
      : nitIn
        ? "nit"
        : "nit";
  const personRaw = text(raw?.personType).toLowerCase();
  const personType: ClientPersonType = personRaw.includes("jur")
    ? "juridica"
    : personRaw.includes("nat")
      ? "natural"
      : "";
  const regimeRaw = text(raw?.regime).toLowerCase();
  const regime: ClientTaxRegime = regimeRaw.includes("simple")
    ? "simple"
    : regimeRaw.includes("especial")
      ? "especial"
      : regimeRaw.includes("no")
        ? "no_responsable"
        : regimeRaw.includes("comun") || regimeRaw.includes("común")
          ? "comun"
          : has("47") || has("48")
            ? "simple"
            : "";

  const responsabilidadesTexto =
    text(raw?.responsabilidadesTexto) ||
    codes
      .map((c) => `${c} ${RESP_LABELS[c] || ""}`.trim())
      .join(" · ");

  return {
    ...base,
    photos: photos?.length ? photos : Array.isArray(raw?.photos) ? raw!.photos : [],
    pdfText: text(raw?.pdfText),
    legalName: text(raw?.legalName),
    tradeName: text(raw?.tradeName),
    nit: split.nit || nitIn.replace(/\D/g, ""),
    dv,
    idType,
    email: text(raw?.email).toLowerCase(),
    phone: text(raw?.phone).replace(/[^\d+\s-]/g, ""),
    address: text(raw?.address),
    city: text(raw?.city),
    department: text(raw?.department),
    personType,
    regime,
    responsibilities: codes,
    agenteRetenedorFuente: agenteFuente,
    agenteRetenedorIva: agenteIva,
    agenteRetenedorIca: agenteIca,
    granContribuyente: gran,
    autorretenedor: auto,
    responsabilidadesTexto,
    extras: text(raw?.extras),
    analyzedAt: text(raw?.analyzedAt) || new Date().toISOString(),
  };
}

export const RUT_SYSTEM = `Eres un analista tributario colombiano. Lees el RUT (Registro Único Tributario de la DIAN) en foto o PDF.
Extrae solo lo que se ve. No inventes NIT, DV, correo ni teléfono. Si un dato no aparece, deja "" o false.

Campos:
- legalName: razón social o nombres y apellidos
- tradeName: nombre comercial si aparece
- nit: número sin dígito de verificación (puede venir con puntos)
- dv: dígito de verificación
- idType: nit | cc | ce | ppt | otro
- email, phone, address, city, department
- personType: natural | juridica
- regime: comun | simple | no_responsable | especial
- responsibilities: array de códigos de responsabilidad (04, 05, 07, 09, 15, 23, 47, 48, etc.)
- agenteRetenedorFuente: true si responsabilidad 07 o el RUT dice agente de retención en la fuente
- agenteRetenedorIva: true si 05 o agente retenedor de IVA
- agenteRetenedorIca: true si dice agente de retención de ICA / industria y comercio
- granContribuyente: true si 09 o "gran contribuyente"
- autorretenedor: true si 15 o autorretenedor
- responsabilidadesTexto: lista legible de casillas marcadas
- extras: observaciones (calidad de imagen, páginas faltantes)

Responde SOLO JSON con esas claves.`;

