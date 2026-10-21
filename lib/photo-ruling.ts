export type FindingSeverity =
  | "critica"
  | "mayor"
  | "menor"
  | "observacion"
  | "conforme";

export type NormRef =
  | "RETIE"
  | "NTC 2050"
  | "NSR-10"
  | "RETILAP"
  | "Resolución 5018"
  | "CREG"
  | "otro";

export const MAX_RULING_PHOTOS = 12;

export interface RulingPhoto {
  id: string;
  /** Siempre "foto1", "foto2"… sin nombre de archivo. */
  caption: string;
  dataUrl: string;
  /** Anotación corta del inspector sobre esta imagen. */
  notaCampo?: string;
}

export interface PhotoFinding {
  id?: string;
  titulo: string;
  criticidad: FindingSeverity;
  hechos: string;
  norma: NormRef | string;
  articulo: string;
  fundamento: string;
  accion: string;
  foto?: number;
}

export interface PhotoReading {
  indice: number;
  descripcion: string;
}

export interface PhotoRuling {
  id: string;
  createdAt: string;
  inspector: string;
  siteNote: string;
  /** Notas del inspector para que la mesa aplique norma y correcciones. */
  fieldNotes: string;
  photos: RulingPhoto[];
  /** Compatibilidad con dictámenes de una sola foto. */
  imageDataUrl: string;
  imageCaption: string;
  resumen: string;
  lecturaPorFoto: PhotoReading[];
  hallazgos: PhotoFinding[];
  conformidades: string[];
  limites: string;
  savedBy?: string;
  savedByName?: string;
}

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critica: "Crítica",
  mayor: "Mayor",
  menor: "Menor",
  observacion: "Observación",
  conforme: "Conforme",
};

export function emptyRuling(): PhotoRuling {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    inspector: "",
    siteNote: "",
    fieldNotes: "",
    photos: [],
    imageDataUrl: "",
    imageCaption: "",
    resumen: "",
    lecturaPorFoto: [],
    hallazgos: [],
    conformidades: [],
    limites: "",
  };
}

export function rulingPhotos(ruling: PhotoRuling): RulingPhoto[] {
  if (ruling.photos?.length) return ruling.photos;
  if (ruling.imageDataUrl) {
    return [
      {
        id: "legacy",
        caption: ruling.imageCaption || "",
        dataUrl: ruling.imageDataUrl,
      },
    ];
  }
  return [];
}

export function photoLabel(index: number) {
  return `foto${index + 1}`;
}

export function reindexPhotoCaptions(photos: RulingPhoto[]): RulingPhoto[] {
  return photos.map((p, i) => ({ ...p, caption: photoLabel(i) }));
}

export function withFindingIds(hallazgos: PhotoFinding[]): PhotoFinding[] {
  return hallazgos.map((h) => ({
    ...h,
    id: h.id || crypto.randomUUID(),
  }));
}

export function emptyFinding(foto?: number): PhotoFinding {
  return {
    id: crypto.randomUUID(),
    titulo: "",
    criticidad: "observacion",
    hechos: "",
    norma: "RETIE",
    articulo: "",
    fundamento: "",
    accion: "",
    foto,
  };
}

export function inspectorDisplayName(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Ingeniero";
  const rest = trimmed.replace(/^(ing\.?|ingenier[oa])\s+/i, "").trim();
  return `Ingeniero ${rest || trimmed}`;
}

export function withSyncedCover(ruling: PhotoRuling): PhotoRuling {
  const photos = reindexPhotoCaptions(
    rulingPhotos(ruling).slice(0, MAX_RULING_PHOTOS)
  );
  const cover = photos[0];
  return {
    ...ruling,
    photos,
    imageDataUrl: cover?.dataUrl || "",
    imageCaption: cover?.caption || "",
    hallazgos: withFindingIds(ruling.hallazgos || []),
  };
}

/** Quita la foto del adjunto y reordena hallazgos / lecturas. */
export function removeRulingPhoto(
  ruling: PhotoRuling,
  photoId: string
): PhotoRuling {
  const photos = rulingPhotos(ruling);
  const idx = photos.findIndex((p) => p.id === photoId);
  if (idx < 0) return ruling;
  const oldNum = idx + 1;
  const nextPhotos = reindexPhotoCaptions(
    photos.filter((p) => p.id !== photoId)
  );
  const hallazgos = withFindingIds(ruling.hallazgos || []).map((h) => {
    const n = Number(h.foto);
    if (!n) return h;
    if (n === oldNum) return { ...h, foto: undefined };
    if (n > oldNum) return { ...h, foto: n - 1 };
    return h;
  });
  const lecturaPorFoto = (ruling.lecturaPorFoto || [])
    .filter((row) => Number(row.indice) !== oldNum)
    .map((row) => {
      const n = Number(row.indice);
      return n > oldNum ? { ...row, indice: n - 1 } : row;
    });
  return withSyncedCover({
    ...ruling,
    photos: nextPhotos,
    hallazgos,
    lecturaPorFoto,
  });
}

export const PHOTO_RULING_SYSTEM = `Eres Ingeniero Héctor Palacio, inspector RETIE e interventor senior de Genera Solutions SAS (Colombia).
Piensas y escribes como quien camina la obra con libreta: frío, preciso, sin adular, sin relleno comercial.
Vas a recibir VARIAS fotografías (foto1, foto2…) y, si las hay, una NOTA CORTA pegada a cada foto más un complemento global. Esas notas son hechos a aplicar. No las ignores. Si una nota no se ve en la foto, trátala como declaración del inspector y márcalo.
NO redactes un bloque largo de “notas de campo”. Toda observación va en la lectura y los hallazgos de ESA foto.

# Oficio
Actúa como interventor / inspector competente, no como chatbot. Por CADA foto:
1) Identifica el recinto (tablero AC/DC, inversor, string, cubierta, tierra, medidor, canalización, BESS, etc.).
2) Describe lo visible en 2 a 4 frases: envolvente, estado, rotulado, conductores, terminales, DPS, tierra, MC4, anclaje, lo que falte.
3) Di qué NO se ve y por eso no se puede cerrar.
4) Cruza la nota de esa foto: si el inspector declara un hallazgo, aplícale RETIE / NTC 2050 y redacta la corrección junto a esa imagen.

# Norma (prioridad según lo visto)
1. RETIE (Res. MME 90708 de 2013 y actualizaciones) — identificaciones, protecciones, tierras, canalización, distancias, competencia, producto certificado.
2. NTC 2050 (CEC) — Art. 110 (instalaciones), 240 (protección), 250 (puesta a tierra), 300/310 (cableado), 408 (tableros), 690 si es FV.
3. NSR-10 — estructura, anclaje, cubierta, corrosión de soporte.
4. RETILAP — solo alumbrado.
5. Res. 5018 de 2019 / SST — riesgo eléctrico, LOTO, altura, EPP.
6. CREG 174 / 030 — frontera, medición, AGPE.

Cite artículo o requisito con la mayor precisión posible. Si el numeral exacto no es seguro, escriba el título del requisito y “(verificar numeral en edición vigente)”. No cite normas que no apliquen a lo visto. Nombre la empresa siempre “Genera Solutions”, nunca solo “GENERA”.
Si el sistema te entrega un Manual operativo de Genera Solutions, ese texto manda sobre tu memoria genérica.

# Hallazgos
- Un hallazgo = un problema. El campo "foto" es OBLIGATORIO (1…n). Cada foto se publica con sus no conformidades al lado.
- "hechos": 2 a 5 frases de lo que SE VE (o lo declarado en la nota de esa foto). Nada genérico.
- "fundamento": por qué incumple el artículo citado.
- "accion": corrección concreta, responsable sugerido (dueño / Genera Solutions / electricista competente) y si impide energizar.
- Criticidad: critica (incendio, electrocución, no energizar), mayor (incumplimiento claro), menor (forma), observacion (buena práctica).
- Esto NO reemplaza dictamen ONAC. Es memoria de interventoría de Genera Solutions.

Responde SOLO JSON válido:
{
  "resumen": "2 a 4 párrafos de síntesis de interventor",
  "lecturaPorFoto": [
    { "indice": 1, "descripcion": "lectura de esa foto, 40-80 palabras, sin repetir un ensayo largo" }
  ],
  "hallazgos": [
    {
      "titulo": "",
      "criticidad": "critica|mayor|menor|observacion",
      "foto": 1,
      "hechos": "",
      "norma": "RETIE|NTC 2050|NSR-10|RETILAP|Resolución 5018|CREG|otro",
      "articulo": "",
      "fundamento": "",
      "accion": ""
    }
  ],
  "conformidades": ["lo correcto, citando foto1 / foto2"],
  "limites": "qué no se puede afirmar"
}`;

/** Inyecta el Manual GENERA del perfil RETIE (Héctor Palacio). */
export function withRetieManual(
  baseSystem: string,
  manuals?: Record<string, string> | null
): string {
  const text = manuals?.retie?.trim();
  if (!text) return baseSystem;
  return `${baseSystem}

## Manual operativo Genera Solutions — Inspector RETIE (prioridad)
Doctrina interna. Prevalece sobre tu memoria genérica de RETIE / NTC 2050.
Si un numeral no está en este manual, cítalo con “(verificar numeral en edición vigente)”.
Aplica lo escrito abajo a cada foto y hallazgo.

${text.slice(0, 12000)}`;
}
