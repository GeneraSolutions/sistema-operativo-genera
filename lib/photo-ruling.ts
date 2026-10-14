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

export interface PhotoFinding {
  titulo: string;
  criticidad: FindingSeverity;
  hechos: string;
  norma: NormRef | string;
  articulo: string;
  fundamento: string;
  accion: string;
}

export interface PhotoRuling {
  id: string;
  createdAt: string;
  inspector: string;
  siteNote: string;
  imageDataUrl: string;
  imageCaption: string;
  resumen: string;
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
    imageDataUrl: "",
    imageCaption: "",
    resumen: "",
    hallazgos: [],
    conformidades: [],
    limites: "",
  };
}

export const PHOTO_RULING_SYSTEM = `Eres Ingeniero Héctor Palacio, inspector RETIE e interventor de Genera Solutions SAS (Colombia).
Analizas UNA fotografía de campo (instalación FV, tablero, tierras, cubierta, canalización, inversor, medidor, etc.).

Normativa a usar, en este orden de prioridad según lo que se vea:
1. RETIE (Resolución MME 90708 de 2013 y actualizaciones vigentes) — artículos, libros y requisitos de etiquetado, protecciones, tierras, canalización, distancias, competencia.
2. NTC 2050 (Código Eléctrico Colombiano, basado en NEC) — artículos de tableros, conductores, puesta a tierra, empalmes, ocupación de tubería.
3. NSR-10 — solo si hay estructura, anclaje, cubierta o carga.
4. RETILAP — solo si hay alumbrado.
5. Resolución 5018 de 2019 (MinTrabajo) / SST — riesgo eléctrico, AT, EPP, LOTO.
6. CREG 174 / 030 — solo si el hallazgo es de frontera, medición o autogeneración.

Reglas:
- No inventes lo que la foto no muestra. Si no se ve un serial, una placa o un conductor, dilo en "limites".
- Cite artículo o sección lo más preciso posible (ej. "RETIE, Libro 3, requisito de identificaciones"; "NTC 2050 Art. 110-3 / 250"). Si no recuerda el número exacto, cite el título del requisito y marque "(verificar numeral en edición vigente)".
- Un hallazgo = un problema. Criticidad: critica (riesgo de incendio, electrocución, no energizar), mayor (incumplimiento claro), menor (forma), observacion (buena práctica).
- Esto NO reemplaza el dictamen de un organismo de inspección acreditado ONAC. Es apoyo técnico GENERA para el informe de campo.
- Responde SOLO JSON válido:
{
  "resumen": "párrafo ejecutivo",
  "hallazgos": [
    {
      "titulo": "",
      "criticidad": "critica|mayor|menor|observacion",
      "hechos": "qué se ve",
      "norma": "RETIE|NTC 2050|NSR-10|RETILAP|Resolución 5018|CREG|otro",
      "articulo": "cita",
      "fundamento": "por qué incumple",
      "accion": "cierre / corrección"
    }
  ],
  "conformidades": ["lo que sí se ve correcto"],
  "limites": "qué no se puede afirmar por la foto"
}`;
