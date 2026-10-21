import type {
  FindingSeverity,
  PhotoFinding,
  PhotoReading,
  PhotoRuling,
} from "@/lib/photo-ruling";
import { withFindingIds } from "@/lib/photo-ruling";

export const NORMS = [
  "RETIE",
  "NTC 2050",
  "NSR-10",
  "RETILAP",
  "Resolución 5018",
  "CREG",
  "otro",
] as const;

export const SEVERITIES: FindingSeverity[] = [
  "critica",
  "mayor",
  "menor",
  "observacion",
  "conforme",
];

export type RulingChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type RefinePatch = {
  reply: string;
  resumen?: string;
  lecturaPorFoto?: PhotoReading[];
  hallazgos?: PhotoFinding[];
  hallazgoParcial?: { index: number; patch: Partial<PhotoFinding> };
  conformidades?: string[];
  limites?: string;
};

export function rulingBriefForChat(ruling: PhotoRuling) {
  const photos = (ruling.photos || []).map((p, i) => ({
    indice: i + 1,
    caption: `foto${i + 1}`,
    notaCampo: p.notaCampo || "",
  }));
  return {
    inspector: ruling.inspector,
    siteNote: ruling.siteNote,
    fieldNotes: ruling.fieldNotes,
    resumen: ruling.resumen,
    photos,
    lecturaPorFoto: ruling.lecturaPorFoto,
    hallazgos: ruling.hallazgos,
    conformidades: ruling.conformidades,
    limites: ruling.limites,
  };
}

export function applyRefinePatch(
  ruling: PhotoRuling,
  patch: RefinePatch
): PhotoRuling {
  let hallazgos = withFindingIds(ruling.hallazgos || []);
  if (Array.isArray(patch.hallazgos)) {
    hallazgos = withFindingIds(patch.hallazgos);
  }
  const partial = patch.hallazgoParcial;
  if (partial && Number.isFinite(partial.index) && partial.patch) {
    hallazgos = hallazgos.map((h, i) =>
      i === partial.index ? { ...h, ...partial.patch, id: h.id } : h
    );
  }
  return {
    ...ruling,
    resumen:
      typeof patch.resumen === "string" && patch.resumen.trim()
        ? patch.resumen
        : ruling.resumen,
    lecturaPorFoto: Array.isArray(patch.lecturaPorFoto)
      ? patch.lecturaPorFoto
      : ruling.lecturaPorFoto,
    hallazgos,
    conformidades: Array.isArray(patch.conformidades)
      ? patch.conformidades.map(String)
      : ruling.conformidades,
    limites:
      typeof patch.limites === "string" ? patch.limites : ruling.limites,
  };
}

export const PHOTO_REFINE_SYSTEM = `Eres Ingeniero Héctor Palacio, inspector RETIE e interventor senior de Genera Solutions SAS.
El inspector humano ya tiene un dictamen borrador y te pide AFINARLO. No reescribas de cero salvo que lo pidan.
Nombre la empresa siempre “Genera Solutions SAS”. Sé breve y técnico.

Recibes el dictamen actual (JSON, sin las imágenes salvo que se adjunte la foto del hallazgo) y un pedido.
Responde SOLO JSON:
{
  "reply": "2 a 5 frases para el inspector: qué cambiaste y por qué",
  "resumen": "solo si hay que tocar la síntesis",
  "lecturaPorFoto": "solo si hay que tocar lecturas (array completo)",
  "hallazgos": "solo si reestructuras todos",
  "hallazgoParcial": { "index": 0, "patch": { "titulo": "", "criticidad": "", "hechos": "", "norma": "", "articulo": "", "fundamento": "", "accion": "", "foto": 1 } },
  "conformidades": "solo si cambian",
  "limites": "solo si cambian"
}
Si te indican un índice de hallazgo, usa hallazgoParcial con ese index (0-based) y no toques el resto.
No inventes fotos. Conserva el tono de interventoría.
Si hay Manual operativo de Genera Solutions SAS, aplícalo al afinar.`;
