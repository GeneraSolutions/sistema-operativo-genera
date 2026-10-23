export type ContentFormat =
  | "reel"
  | "short"
  | "historia"
  | "post"
  | "live";

export type ContentNetwork =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube";

export type ContentObjective = "educar" | "confianza" | "contacto";

export type ContentStatus =
  | "idea"
  | "aprobado"
  | "grabado"
  | "publicado";

export interface ContentPiece {
  id: string;
  date: string;
  format: ContentFormat;
  network: ContentNetwork;
  title: string;
  hook: string;
  script: string;
  location: string;
  durationSec: number;
  cta: string;
  objective: ContentObjective;
  status: ContentStatus;
  owner: string;
  bankId?: string;
  notes: string;
  updatedAt: string;
}

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  reel: "Reel",
  short: "Short",
  historia: "Historia",
  post: "Post / carrusel",
  live: "Live",
};

export const CONTENT_NETWORK_LABELS: Record<ContentNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const CONTENT_OBJECTIVE_LABELS: Record<ContentObjective, string> = {
  educar: "Educar",
  confianza: "Confianza",
  contacto: "Pedir contacto",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  idea: "Idea",
  aprobado: "Aprobado",
  grabado: "Grabado",
  publicado: "Publicado",
};

export const CONTENT_STATUS_TONE: Record<ContentStatus, string> = {
  idea: "bg-[#f7f4ee] text-[#6d7c74]",
  aprobado: "bg-[#eef4fa] text-[#2a5f8f]",
  grabado: "bg-[#fff4e5] text-[#9a5b00]",
  publicado: "bg-[#e8f6ee] text-[#1f6b45]",
};

const KEY = "genera.contenido.v1";

export interface ContentIdea {
  id: string;
  title: string;
  format: ContentFormat;
  objective: ContentObjective;
  hook: string;
  script: string;
  location: string;
  durationSec: number;
  cta: string;
}

/** Banco para rotar. Daniela lo usa; si no hay API, siembra la semana con esto. */
export const CONTENT_BANK: ContentIdea[] = [
  {
    id: "mito-lluvia",
    title: "El solar no sirve cuando llueve",
    format: "reel",
    objective: "educar",
    hook: "¿Y si está nublado toda la semana?",
    script:
      "Lluvia y nubes bajan la producción. No apagan el sistema. Muestra el inversor un día gris vs un día claro. Cierra: por eso se dimensiona con HSP de su ciudad, no con un día perfecto.",
    location: "Tablero / app de monitoreo",
    durationSec: 30,
    cta: "Guarda este Reel si te lo han preguntado.",
  },
  {
    id: "que-es-kwp",
    title: "Qué es un kWp en 20 segundos",
    format: "reel",
    objective: "educar",
    hook: "kWp no es lo que dice tu recibo.",
    script:
      "kWp es el tamaño del techo solar. kWh es lo que produce y lo que cobras. Analogía: el kWp es el tanque; el kWh es el agua que sale. Sin cifras mágicas.",
    location: "Frente a paneles o maqueta",
    durationSec: 25,
    cta: "Síguenos: cada semana un término, sin humo.",
  },
  {
    id: "panel-inversor-bateria",
    title: "Tres cajas: panel, inversor, batería",
    format: "short",
    objective: "educar",
    hook: "Si no sabes qué hace cada uno, no cotices a ciegas.",
    script:
      "Panel: captura sol. Inversor: lo vuelve corriente de la casa. Batería: opcional, guarda para la noche. No todos los techos necesitan batería.",
    location: "Obra o bodega",
    durationSec: 28,
    cta: "Comenta BATERÍA si quieres el Reel de sí/no.",
  },
  {
    id: "llave-vs-equipos",
    title: "Planta llave en mano vs solo equipos",
    format: "reel",
    objective: "educar",
    hook: "No es el mismo contrato.",
    script:
      "Llave en mano: diseño, equipos, instalación, RETIE. Solo equipos: usted instala. Diga cuándo aplica cada uno. No hable mal del cliente que solo compra equipos.",
    location: "Oficina o escritorio con dos papeles",
    durationSec: 32,
    cta: "¿Cuál necesitas? Escríbelo en comentarios.",
  },
  {
    id: "ley-1715-honesta",
    title: "Ley 1715 no te rebaja esta factura",
    format: "reel",
    objective: "confianza",
    hook: "Nadie te devuelve la mitad del proyecto mañana.",
    script:
      "Pagas ahora. El 50 % es deducción de renta, con tu contador, no plata en efectivo. IVA de paneles es otro cuento. Si no es responsable de renta, no vendas el incentivo.",
    location: "Cámara al frente, recibo tapado",
    durationSec: 35,
    cta: "Comparte esto con quien te cotizó ‘la mitad regalada’.",
  },
  {
    id: "retie-una-frase",
    title: "RETIE en una frase",
    format: "historia",
    objective: "educar",
    hook: "RETIE no es un impuesto inventado.",
    script:
      "Es el reglamento de instalaciones eléctricas. Sin eso no se energiza en regla. Tres fotos: aviso, tablero, firma.",
    location: "Tablero de planta",
    durationSec: 15,
    cta: "Siguiente historia: qué pasa si alguien ‘ahorra’ saltándoselo.",
  },
  {
    id: "visita-que-miden",
    title: "Qué miramos en una visita",
    format: "reel",
    objective: "confianza",
    hook: "No es tomarse un café en el techo.",
    script:
      "Cubierta, sombras, tablero, espacio de inversor, recibo. Si no hay visita, lo dice el contrato. Muestre cinta, foto de techo, unifilar grosero en papel.",
    location: "Visita real (con permiso)",
    durationSec: 30,
    cta: "Agenda visita por WhatsApp cuando el techo ya está elegido.",
  },
  {
    id: "garantia-de-verdad",
    title: "Qué cubre la garantía (de verdad)",
    format: "reel",
    objective: "confianza",
    hook: "25 años no significa que Genera Solutions SAS pague todo.",
    script:
      "Módulo: fabricante. Mano de obra: lo que diga el contrato. Mal uso, terceros y rayos no. Enseñe la ficha o el artículo de garantías.",
    location: "Escritorio con contrato (sin datos de cliente)",
    durationSec: 32,
    cta: "Pida siempre las fichas, no solo el número de años.",
  },
  {
    id: "nit-en-pantalla",
    title: "Quiénes somos, NIT en pantalla",
    format: "historia",
    objective: "confianza",
    hook: "Empresa real, no un perfil de hace 15 días.",
    script:
      "Genera Solutions SAS · NIT 901718535-1. Un plano de obra o logo. Sin discurso largo.",
    location: "Oficina / logo",
    durationSec: 12,
    cta: "WhatsApp en la bio cuando pidan cotización.",
  },
  {
    id: "techo-recorrido",
    title: "10 segundos de un techo instalado",
    format: "reel",
    objective: "confianza",
    hook: "Esto es lo que queda cuando nos vamos.",
    script:
      "Recorrido estable, anclajes, canaleta, inversor. Sin música que tape. Un texto: kWp del proyecto si el cliente autoriza; si no, ‘planta residencial Cundinamarca’.",
    location: "Obra entregada",
    durationSec: 20,
    cta: "Guarda para mostrarle a quien duda del acabado.",
  },
  {
    id: "recibo-linea",
    title: "Una línea del recibo",
    format: "short",
    objective: "educar",
    hook: "El solar no apaga el cargo fijo.",
    script:
      "Señale consumo kWh vs comercializador/cargo fijo. El panel baja energía; no borra todo el papel. Recibo con datos tapados.",
    location: "Mesa, recibo impreso",
    durationSec: 25,
    cta: "Mande foto de su recibo (sin cédula) si quiere lectura grosera.",
  },
  {
    id: "sombra-tanque",
    title: "La sombra de un tanque",
    format: "reel",
    objective: "educar",
    hook: "Este tanque se come un string entero.",
    script:
      "Muestre sombra a las 10 a.m. Un módulo sombreado no es ‘un poquito menos’: puede tumbar la fila. Por eso la visita mira obstáculos.",
    location: "Cubierta con tanque o antena",
    durationSec: 28,
    cta: "Foto de su techo a las 10 a.m. y te decimos si hay pelea.",
  },
  {
    id: "bateria-no-obligatoria",
    title: "La batería no es obligatoria",
    format: "reel",
    objective: "educar",
    hook: "Te cotizaron batería y no sabes por qué.",
    script:
      "Red estable + recibo alto de día: a veces no. Cortes largos o noche crítica: sí. Pregunta: ¿te vas la luz 2 horas o 12? Sin vender miedo.",
    location: "Bodega junto a un BESS",
    durationSec: 30,
    cta: "Comenta CORTES o ESTABLE y te armamos el criterio.",
  },
  {
    id: "no-desconecte-red",
    title: "No te desconectas de la red ya",
    format: "historia",
    objective: "educar",
    hook: "Off-grid es otro proyecto, otra plata.",
    script:
      "Autogeneración conectada a red es lo normal en ciudad. Desconectarse pide batería grande y diseño distinto. No lo prometan en un Reel de 15 s.",
    location: "Medidor / acometida",
    durationSec: 15,
    cta: "Historia 2: qué sí hace el excedente.",
  },
  {
    id: "cta-recibo",
    title: "Si el recibo ya duele, hablemos",
    format: "reel",
    objective: "contacto",
    hook: "No cotizamos curiosidad: cotizamos recibos.",
    script:
      "Si la energía se comió el mes, mande recibo (datos personales tapados) y 3 fotos de cubierta. WhatsApp de Genera Solutions SAS. Un solo CTA. Sin ‘te ahorras X %’.",
    location: "Cámara al frente o techo",
    durationSec: 25,
    cta: "WhatsApp en la bio · recibo + fotos del techo.",
  },
  {
    id: "datos-para-cotizar",
    title: "Qué enviar para cotizar",
    format: "post",
    objective: "contacto",
    hook: "Cuatro cosas. No un ensayo.",
    script:
      "Carrusel: 1 recibo 2 fotos techo 3 ciudad 4 si quiere batería. Promesa: con eso se arma una oferta seria, no un número de servilleta.",
    location: "Gráfico simple / oficina",
    durationSec: 0,
    cta: "WhatsApp · esas cuatro cosas.",
  },
  {
    id: "detras-camara-visita",
    title: "Detrás de cámaras: visita",
    format: "historia",
    objective: "confianza",
    hook: "Hoy hay visita. Les mostramos el techo (con permiso).",
    script:
      "3–4 historias: llegada, cinta, tablero, ‘esto lo vemos en el informe’. Sin nombres de cliente si no hay permiso.",
    location: "Campo",
    durationSec: 12,
    cta: "Reel de la semana sale mañana.",
  },
  {
    id: "app-un-numero",
    title: "La app: un número del día",
    format: "short",
    objective: "confianza",
    hook: "Así se ve un día de sol en la planta.",
    script:
      "Pantalla de monitoreo, kWh del día, sin inventar anual. ‘Esto es un día; el diseño usa el año.’",
    location: "Celular / planta",
    durationSec: 18,
    cta: "El cliente ve esto; nosotros también.",
  },
];

const WEEKDAY_PLAN: {
  offset: number;
  format: ContentFormat;
  network: ContentNetwork;
}[] = [
  { offset: 0, format: "reel", network: "instagram" },
  { offset: 1, format: "historia", network: "instagram" },
  { offset: 2, format: "short", network: "tiktok" },
  { offset: 3, format: "post", network: "instagram" },
  { offset: 4, format: "reel", network: "instagram" },
];

export function mondayOf(isoDate?: string): string {
  const d = isoDate
    ? new Date(`${isoDate.slice(0, 10)}T12:00:00`)
    : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function weekdayLabel(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });
}

export function emptyPiece(partial?: Partial<ContentPiece>): ContentPiece {
  const date = partial?.date || new Date().toISOString().slice(0, 10);
  return {
    id: crypto.randomUUID(),
    date,
    format: "reel",
    network: "instagram",
    title: "",
    hook: "",
    script: "",
    location: "",
    durationSec: 30,
    cta: "",
    objective: "educar",
    status: "idea",
    owner: "",
    notes: "",
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

export function pieceFromIdea(
  idea: ContentIdea,
  date: string,
  network: ContentNetwork
): ContentPiece {
  return emptyPiece({
    date,
    format: idea.format,
    network,
    title: idea.title,
    hook: idea.hook,
    script: idea.script,
    location: idea.location,
    durationSec: idea.durationSec,
    cta: idea.cta,
    objective: idea.objective,
    bankId: idea.id,
    status: "idea",
  });
}

export function seedWeekFromBank(weekStart: string): ContentPiece[] {
  const weekIndex = Math.floor(
    (Date.parse(`${weekStart}T12:00:00`) - Date.parse("2026-01-05T12:00:00")) /
      (7 * 86400000)
  );
  const start = ((weekIndex % CONTENT_BANK.length) + CONTENT_BANK.length) % CONTENT_BANK.length;
  return WEEKDAY_PLAN.map((slot, i) => {
    const idea = CONTENT_BANK[(start + i) % CONTENT_BANK.length];
    return pieceFromIdea(idea, addDays(weekStart, slot.offset), slot.network);
  });
}

export function sanitizePiece(raw: Partial<ContentPiece> | null | undefined): ContentPiece | null {
  if (!raw || typeof raw !== "object") return null;
  const date = String(raw.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const format = (["reel", "short", "historia", "post", "live"] as ContentFormat[]).includes(
    raw.format as ContentFormat
  )
    ? (raw.format as ContentFormat)
    : "reel";
  const network = (
    ["instagram", "facebook", "tiktok", "youtube"] as ContentNetwork[]
  ).includes(raw.network as ContentNetwork)
    ? (raw.network as ContentNetwork)
    : "instagram";
  const objective = (
    ["educar", "confianza", "contacto"] as ContentObjective[]
  ).includes(raw.objective as ContentObjective)
    ? (raw.objective as ContentObjective)
    : "educar";
  const status = (
    ["idea", "aprobado", "grabado", "publicado"] as ContentStatus[]
  ).includes(raw.status as ContentStatus)
    ? (raw.status as ContentStatus)
    : "idea";
  return {
    id: String(raw.id || crypto.randomUUID()),
    date,
    format,
    network,
    title: String(raw.title || "").trim(),
    hook: String(raw.hook || "").trim(),
    script: String(raw.script || "").trim(),
    location: String(raw.location || "").trim(),
    durationSec: Math.max(0, Number(raw.durationSec) || 0),
    cta: String(raw.cta || "").trim(),
    objective,
    status,
    owner: String(raw.owner || "").trim(),
    bankId: raw.bankId ? String(raw.bankId) : undefined,
    notes: String(raw.notes || "").trim(),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

export function loadContent(): ContentPiece[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]") as ContentPiece[];
    return Array.isArray(parsed)
      ? parsed.map((p) => sanitizePiece(p)).filter(Boolean) as ContentPiece[]
      : [];
  } catch {
    return [];
  }
}

export function replaceContent(pieces: ContentPiece[]): ContentPiece[] {
  const next = pieces
    .map((p) => sanitizePiece(p))
    .filter(Boolean) as ContentPiece[];
  localStorage.setItem(KEY, JSON.stringify(next.slice(0, 400)));
  return next;
}

export function upsertContent(piece: ContentPiece): ContentPiece[] {
  const stamped = {
    ...emptyPiece(piece),
    updatedAt: new Date().toISOString(),
  };
  const next = [
    stamped,
    ...loadContent().filter((p) => p.id !== stamped.id),
  ];
  return replaceContent(next);
}

export function deleteContent(id: string): ContentPiece[] {
  return replaceContent(loadContent().filter((p) => p.id !== id));
}

export function mergeContent(
  local: ContentPiece[],
  remote: ContentPiece[]
): ContentPiece[] {
  const byId = new Map<string, ContentPiece>();
  for (const piece of [...remote, ...local]) {
    const clean = sanitizePiece(piece);
    if (!clean) continue;
    const prev = byId.get(clean.id);
    const prevT = Date.parse(prev?.updatedAt || "") || 0;
    const nextT = Date.parse(clean.updatedAt || "") || 0;
    if (!prev || nextT >= prevT) byId.set(clean.id, clean);
  }
  return [...byId.values()].sort((a, b) =>
    `${a.date}${a.title}`.localeCompare(`${b.date}${b.title}`, "es")
  );
}

export function piecesInWeek(pieces: ContentPiece[], weekStart: string) {
  const dates = new Set(weekDates(weekStart));
  return pieces.filter((p) => dates.has(p.date));
}

export function persistContentCloud(pieces: ContentPiece[]) {
  void fetch("/api/contenido", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pieces }),
  }).catch(() => undefined);
}
