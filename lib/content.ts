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
const DELETED_KEY = "genera.contenido.deleted.v1";

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
  /** Por qué esta pieza entra al banco: objeción o momento real de venta. */
  why: string;
}

/** Doctrina corta si no hay manual pegado en Inteligencia. */
export const CONTENT_PLAYBOOK = `Genera Solutions SAS. Filman ustedes, bajo presupuesto, en visita u oficina (Carrera 79 # 7A-53, Bogotá).
Nombre legal siempre completo. NIT 901718535-1. WhatsApp 317 455 3288, un CTA por semana.
Lo que sí funciona: recibo tapado, techo a las 10 a.m., visita con cinta, RETIE, Ley 1715 sin efectivo, “no te quitas la factura”, recorrido de planta entregada con permiso.
No kWh ni payback inventados. No “te ahorras X %”. HSP de la ciudad, no un día de comercial. Off-grid es otro proyecto.
Varía el banco; no repitas el mismo mito dos semanas seguidas.`;

/** Banco para rotar. Daniela lo usa; si no hay API, siembra la semana con esto. */
export const CONTENT_BANK: ContentIdea[] = [
  {
    id: "mito-lluvia",
    title: "El solar no sirve cuando llueve",
    format: "reel",
    objective: "educar",
    hook: "¿Y si está nublado toda la semana?",
    script:
      "A cámara: la lluvia y las nubes bajan la producción. No apagan el sistema. Muestra el inversor un día gris contra uno claro. Cierra: por eso se dimensiona con HSP de su ciudad, no con el día perfecto del comercial.",
    location: "Tablero o app de monitoreo",
    durationSec: 30,
    cta: "Guarda esto si te lo han preguntado.",
    why: "Objeción número uno en visita y en inbox.",
  },
  {
    id: "nit-en-pantalla",
    title: "Quiénes somos, NIT en pantalla",
    format: "historia",
    objective: "confianza",
    hook: "Empresa real, no un perfil de hace 15 días.",
    script:
      "Genera Solutions SAS. NIT 901718535-1. Bogotá, Carrera 79. Un plano o el logo. Sin discurso.",
    location: "Oficina / logo",
    durationSec: 12,
    cta: "La cotización seria va con razón social.",
    why: "Corta la desconfianza de perfiles nuevos que cotizan en comentarios.",
  },
  {
    id: "recibo-linea",
    title: "El solar no apaga el cargo fijo",
    format: "short",
    objective: "educar",
    hook: "Esto del recibo no se va a cero.",
    script:
      "Señale consumo en kWh frente a cargo fijo y comercializador. Los paneles bajan energía. No borran el papel. Recibo con cédula y dirección tapadas.",
    location: "Mesa, recibo impreso",
    durationSec: 25,
    cta: "Mande foto del recibo, sin cédula, si quiere una lectura grosera.",
    why: "La gente llega pidiendo ‘quitarse la factura’. Este Reel la baja a tierra.",
  },
  {
    id: "ley-1715-honesta",
    title: "Ley 1715 no te rebaja esta factura",
    format: "post",
    objective: "confianza",
    hook: "Nadie te devuelve la mitad del proyecto mañana.",
    script:
      "Carrusel: 1 paga ahora. 2 el 50 % es deducción de renta, con su contador, no efectivo. 3 IVA de módulos es otro trámite. 4 si no es responsable de renta, no venda el incentivo.",
    location: "Gráfico simple / oficina",
    durationSec: 0,
    cta: "Compártelo con quien le cotizó ‘la mitad regalada’.",
    why: "Misma frase que ya usan comercial y el contador en el OS.",
  },
  {
    id: "cta-recibo",
    title: "Si el recibo ya duele, hablemos",
    format: "reel",
    objective: "contacto",
    hook: "No cotizamos curiosidad: cotizamos recibos.",
    script:
      "Si la energía se comió el mes: recibo (datos tapados) y tres fotos de cubierta. WhatsApp de Genera Solutions SAS. Un solo CTA. Sin ‘te ahorras X %’.",
    location: "Cámara al frente o techo",
    durationSec: 25,
    cta: "WhatsApp en la bio · recibo + fotos del techo.",
    why: "El CTA que sí convierte: evidencia, no curiosidad.",
  },
  {
    id: "visita-que-miden",
    title: "Qué miramos en una visita",
    format: "reel",
    objective: "confianza",
    hook: "No es tomarse un café en el techo.",
    script:
      "Cubierta, sombras, tablero, espacio del inversor, recibo. Muestre cinta, foto de techo, un trazo de unifilar en papel. Si no hay visita, el contrato lo dice.",
    location: "Visita real (con permiso)",
    durationSec: 30,
    cta: "Guarda el orden: techo primero, precio después.",
    why: "Muestra el método del OS (visita técnica) y filtra cotizaciones de servilleta.",
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
    cta: "Siguiente: qué pasa si alguien ‘ahorra’ saltándoselo.",
    why: "Pregunta de obra y de cliente que vio un precio más barato.",
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
    cta: "Comenta CORTES o ESTABLE y armamos el criterio.",
    why: "Desarma cotizaciones que meten BESS por default.",
  },
  {
    id: "garantia-de-verdad",
    title: "Qué cubre la garantía (de verdad)",
    format: "post",
    objective: "confianza",
    hook: "25 años no significa que Genera Solutions SAS pague todo.",
    script:
      "Carrusel: módulo = fabricante. Mano de obra = lo que diga el contrato. Mal uso, terceros y rayos, no. Pida fichas, no solo el número de años.",
    location: "Escritorio, contrato sin datos de cliente",
    durationSec: 0,
    cta: "Pida siempre las fichas.",
    why: "Misma claridad que el contrato y las fichas del cotizador.",
  },
  {
    id: "datos-para-cotizar",
    title: "Qué enviar para cotizar",
    format: "reel",
    objective: "contacto",
    hook: "Cuatro cosas. No un ensayo.",
    script:
      "Uno: recibo. Dos: fotos del techo. Tres: ciudad. Cuatro: si quiere batería. Con eso se arma una oferta seria, no un número de servilleta.",
    location: "Oficina, cuatro papeles en mesa",
    durationSec: 22,
    cta: "WhatsApp · esas cuatro cosas.",
    why: "Reduce idas y vueltas. Es el intake que ya pide el comercial.",
  },
  {
    id: "no-te-quitas-factura",
    title: "No te quitas la factura",
    format: "reel",
    objective: "educar",
    hook: "Si alguien te dijo ‘te quitas la factura’, te mintió.",
    script:
      "Sigues con comercializador, cargo fijo y el mes feo. El solar baja kWh de red. No desaparece el papel. Cierra: por eso leemos el recibo, no un Reel de 15 segundos.",
    location: "Cámara al frente, recibo tapado",
    durationSec: 28,
    cta: "Guarda esto antes de cotizar por comentarios.",
    why: "Doctrina de marca en el OS. Hay que repetirla en cámara.",
  },
  {
    id: "detras-camara-visita",
    title: "Detrás de cámaras: visita",
    format: "historia",
    objective: "confianza",
    hook: "Hoy hay visita. Les mostramos el techo (con permiso).",
    script:
      "Tres o cuatro historias: llegada, cinta, tablero, ‘esto va al informe’. Sin nombres si no hay permiso.",
    location: "Campo",
    durationSec: 12,
    cta: "El Reel de la semana sale mañana.",
    why: "Costo cero si ya están en visita. El equipo ya filma esto.",
  },
  {
    id: "sombra-tanque",
    title: "La sombra de un tanque",
    format: "short",
    objective: "educar",
    hook: "Este tanque se come un string entero.",
    script:
      "Sombra a las 10 a.m. Un módulo sombreado no es ‘un poquito menos’: puede tumbar la fila. Por eso la visita mira obstáculos.",
    location: "Cubierta con tanque o antena",
    durationSec: 28,
    cta: "Foto de su techo a las 10 a.m.",
    why: "Se ve en casi toda visita residencial del altiplano.",
  },
  {
    id: "primera-factura-rara",
    title: "La primera factura con solar se ve rara",
    format: "post",
    objective: "confianza",
    hook: "El primer ciclo casi siempre confunde. Es normal.",
    script:
      "Carrusel: autoconsumo, excedentes, por qué el primer mes no se parece al cotizado. Sin kWh inventados. Cierre: en Genera Solutions SAS cruzamos factura y monitoreo en el mes 1 y el mes 3.",
    location: "Gráfico / oficina",
    durationSec: 0,
    cta: "Esto va en la entrega, no es un ‘ya vieron’.",
    why: "Ya lo entregan como bono. En redes educa y baja tickets postventa.",
  },
  {
    id: "techo-recorrido",
    title: "10 segundos de un techo instalado",
    format: "reel",
    objective: "confianza",
    hook: "Esto es lo que queda cuando nos vamos.",
    script:
      "Recorrido estable: anclajes, canaleta, inversor. Sin música que tape. Texto: kWp solo si el cliente autoriza; si no, ‘planta residencial Cundinamarca’.",
    location: "Obra entregada (permiso)",
    durationSec: 20,
    cta: "Guarda para mostrarle a quien duda del acabado.",
    why: "Prueba de oficio. Mejor que cualquier testimonio escrito.",
  },
  {
    id: "que-es-kwp",
    title: "Qué es un kWp en 20 segundos",
    format: "reel",
    objective: "educar",
    hook: "kWp no es lo que dice tu recibo.",
    script:
      "kWp es el tamaño del techo solar. kWh es lo que produce y lo que cobra el comercializador. El kWp es el tanque; el kWh es el agua que sale. Sin cifras mágicas.",
    location: "Frente a paneles o maqueta",
    durationSec: 25,
    cta: "Cada semana un término, sin humo.",
    why: "Lenguaje del cotizador. Evita que comparen kWp con kWh del recibo.",
  },
  {
    id: "no-desconecte-red",
    title: "No te desconectas de la red ya",
    format: "historia",
    objective: "educar",
    hook: "Off-grid es otro proyecto, otra plata.",
    script:
      "En ciudad lo normal es autogeneración conectada a red. Desconectarse pide batería grande y otro diseño. No lo prometan en 15 segundos.",
    location: "Medidor / acometida",
    durationSec: 15,
    cta: "Historia 2: qué sí hace el excedente.",
    why: "Objeción de independencia total. Hay que cortarla rápido.",
  },
  {
    id: "app-un-numero",
    title: "La app: un número del día",
    format: "short",
    objective: "confianza",
    hook: "Así se ve un día de sol en la planta.",
    script:
      "Pantalla de monitoreo, kWh de ESE día, sin inventar el año. ‘Esto es un día. El diseño usa el año.’",
    location: "Celular / planta",
    durationSec: 18,
    cta: "El cliente ve esto. Nosotros también.",
    why: "El bono de monitoreo 24/7 ya está en la propuesta. Hay que mostrarlo.",
  },
  {
    id: "llave-vs-equipos",
    title: "Planta llave en mano vs solo equipos",
    format: "post",
    objective: "educar",
    hook: "No es el mismo contrato.",
    script:
      "Carrusel: llave en mano = diseño, equipos, instalación, RETIE. Solo equipos = usted instala. Cuándo aplica cada uno. Sin hablar mal de quien solo compra equipos.",
    location: "Escritorio, dos papeles",
    durationSec: 0,
    cta: "Diga cuál necesita antes de pedir precio.",
    why: "El OS ya cotiza las dos. El contenido debe separarlas.",
  },
  {
    id: "precio-en-comentarios",
    title: "No doy precio en comentarios",
    format: "reel",
    objective: "contacto",
    hook: "El que cotiza 12 kW por un comentario, está adivinando.",
    script:
      "Sin recibo, techo y ciudad no hay número serio. WhatsApp: esas tres cosas. Genera Solutions SAS no pelea el precio más bajo de Facebook.",
    location: "Cámara al frente",
    durationSec: 24,
    cta: "WhatsApp en la bio · recibo + techo + ciudad.",
    why: "Defiende el cotizador y corta la guerra de precios.",
  },
  {
    id: "bateria-no-obligatoria",
    title: "La batería no es obligatoria",
    format: "reel",
    objective: "educar",
    hook: "Te cotizaron batería y no sabes por qué.",
    script:
      "Red estable y recibo alto de día: a veces no. Cortes largos o noche crítica: sí. Pregunte: ¿se va la luz 2 horas o 12? Sin vender miedo.",
    location: "Bodega junto a un BESS",
    durationSec: 30,
    cta: "Comenta CORTES o ESTABLE.",
    why: "Evita sobrecosto y alinea con el cotizador de equipos.",
  },
  {
    id: "epp-en-techo",
    title: "Arnés o no hay techo",
    format: "historia",
    objective: "confianza",
    hook: "Si no hay línea de vida, no subimos.",
    script:
      "Casco, arnés, línea. Tres fotos. ‘El precio barato a veces es alguien sin EPP.’",
    location: "Visita o obra, EPP puesto",
    durationSec: 12,
    cta: "Así trabajamos en Genera Solutions SAS.",
    why: "Diferencia de oficio. SST ya es un módulo del OS.",
  },
  {
    id: "excedente-que-es",
    title: "Qué es un excedente",
    format: "short",
    objective: "educar",
    hook: "Lo que no se come la casa no es plata en el bolsillo al día siguiente.",
    script:
      "Autoconsumo: lo usa usted. Excedente: sale a la red según el comercializador. No prometa tarifa ni plazo. Cierre: por eso la primera factura se ve rara.",
    location: "Tablero / medidor",
    durationSec: 28,
    cta: "La guía de primera factura sale en la entrega.",
    why: "Misma pedagogía que el bono de primera factura.",
  },
  {
    id: "techo-aguanta",
    title: "¿El techo aguanta?",
    format: "post",
    objective: "confianza",
    hook: "El panel no se pone si la cubierta no da.",
    script:
      "Carrusel: tipo de cubierta, anclaje, pendiente, corrosión. Si hay duda, mira estructura. Sin asustar: ‘mejor un no a tiempo que un sí barato’.",
    location: "Cubierta o foto de visita",
    durationSec: 0,
    cta: "La visita mira esto antes del precio.",
    why: "Objeción estructural real. Encaja con el especialista NSR-10.",
  },
  {
    id: "hsp-ciudad",
    title: "HSP de su ciudad, no de un comercial",
    format: "reel",
    objective: "educar",
    hook: "El sol de un Reel de la Costa no es el de Bogotá.",
    script:
      "Se diseña con horas pico sol de su ciudad. No con el día más bonito de un anuncio. Sin decir un kWh. Cierre: por eso pedimos ciudad y recibo.",
    location: "Mapa o ventana a Bogotá",
    durationSec: 26,
    cta: "Diga su ciudad, no ‘máximo sol’.",
    why: "El cotizador ya usa HSP/IDEAM. El contenido debe defenderlo.",
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

export function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalYmd(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function mondayOf(isoDate?: string): string {
  const d = isoDate ? parseLocalYmd(isoDate) : new Date();
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localYmd(d);
}

export function addDays(iso: string, days: number): string {
  const d = parseLocalYmd(iso);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function startOfMonth(iso: string): string {
  const d = parseLocalYmd(iso);
  d.setDate(1);
  return localYmd(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseLocalYmd(iso);
  d.setMonth(d.getMonth() + months);
  return localYmd(d);
}

export function monthLabel(iso: string): string {
  const text = parseLocalYmd(iso).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 6 semanas (42 días) empezando el lunes de la semana del día 1. */
export function monthGrid(iso: string): string[] {
  const start = mondayOf(startOfMonth(iso));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekdayLabel(iso: string) {
  return parseLocalYmd(iso).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
  });
}

export function weekdayLong(iso: string) {
  return parseLocalYmd(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export const WEEKDAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function emptyPiece(partial?: Partial<ContentPiece>): ContentPiece {
  const date = partial?.date || localYmd();
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
    notes: idea.why,
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

export function loadDeletedContentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]") as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 500) : [];
  } catch {
    return [];
  }
}

export function saveDeletedContentIds(ids: string[]): string[] {
  const next = [...new Set(ids.filter(Boolean))].slice(-500);
  if (typeof window !== "undefined") {
    localStorage.setItem(DELETED_KEY, JSON.stringify(next));
  }
  return next;
}

export function rememberDeletedContent(id: string): string[] {
  return saveDeletedContentIds([...loadDeletedContentIds(), id]);
}

export function deleteContent(id: string): ContentPiece[] {
  rememberDeletedContent(id);
  return replaceContent(loadContent().filter((p) => p.id !== id));
}

export function mergeContent(
  local: ContentPiece[],
  remote: ContentPiece[],
  deletedIds: string[] = []
): ContentPiece[] {
  const banned = new Set(deletedIds.filter(Boolean));
  const byId = new Map<string, ContentPiece>();
  for (const piece of [...remote, ...local]) {
    const clean = sanitizePiece(piece);
    if (!clean || banned.has(clean.id)) continue;
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
    body: JSON.stringify({
      pieces,
      deletedIds: loadDeletedContentIds(),
    }),
  }).catch(() => undefined);
}
