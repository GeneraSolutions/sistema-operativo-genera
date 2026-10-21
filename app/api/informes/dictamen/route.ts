import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import {
  MAX_RULING_PHOTOS,
  PHOTO_RULING_SYSTEM,
  withRetieManual,
  type PhotoFinding,
  type PhotoReading,
  type PhotoRuling,
  type RulingPhoto,
} from "@/lib/photo-ruling";

export const runtime = "nodejs";
export const maxDuration = 90;

interface Body {
  photos?: RulingPhoto[];
  imageDataUrl?: string;
  caption?: string;
  siteNote?: string;
  inspector?: string;
  fieldNotes?: string;
  manuals?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = (await req.json()) as Body;
    const photos = (
      body.photos?.length
        ? body.photos
        : body.imageDataUrl
          ? [
              {
                id: "one",
                caption: body.caption || "",
                dataUrl: body.imageDataUrl,
              },
            ]
          : []
    )
      .filter((p) => p.dataUrl?.startsWith("data:image"))
      .slice(0, MAX_RULING_PHOTOS);

    if (!photos.length) {
      return NextResponse.json(
        { error: "Suba al menos una fotografía válida." },
        { status: 400 }
      );
    }

    const catalog = photos
      .map((p, i) => {
        const note = p.notaCampo?.trim();
        return `foto${i + 1}${note ? ` — nota de esta imagen: ${note}` : ""}`;
      })
      .join("\n");

    const hint = [
      body.inspector && `Inspector: ${body.inspector}`,
      body.siteNote && `Sitio / contexto: ${body.siteNote}`,
      catalog && `Inventario fotográfico:\n${catalog}`,
      body.fieldNotes?.trim() &&
        `Complemento global (no es un capítulo del informe; aplíquelo en la foto que corresponda):\n${body.fieldNotes.trim()}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const offline = offlineRuling(hint, photos.length);
      await appendIntelligenceLog(session, {
        mode: "specialist",
        specialistLabel: "Dictamen fotográfico RETIE",
        question: hint.slice(0, 4000) || "Fotos de campo",
        answer: offline.resumen,
      });
      return NextResponse.json({ ...offline, offline: true });
    }

    const client = new OpenAI({ apiKey });
    const imageParts = photos.flatMap((p, i) => [
      {
        type: "text" as const,
        text: `— Inicio foto${i + 1}${p.notaCampo?.trim() ? `. Nota de esta imagen: ${p.notaCampo.trim()}` : ""} —`,
      },
      {
        type: "image_url" as const,
        image_url: { url: p.dataUrl, detail: "high" as const },
      },
    ]);

    const completion = await client.chat.completions.create({
      model:
        process.env.OPENAI_VISION_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-4o",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: withRetieManual(PHOTO_RULING_SYSTEM, body.manuals),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Dictamine como interventor el conjunto de ${photos.length} evidencias.\n\n${hint}`,
            },
            ...imageParts,
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = parseDraft(raw);
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: "Dictamen fotográfico RETIE",
      question: hint.slice(0, 4000) || "Fotos de campo",
      answer: parsed.resumen,
    });
    return NextResponse.json({ ...parsed, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo analizar la foto: ${detail}` },
      { status: 500 }
    );
  }
}

function parseDraft(raw: string): Pick<
  PhotoRuling,
  "resumen" | "lecturaPorFoto" | "hallazgos" | "conformidades" | "limites"
> {
  try {
    const parsed = JSON.parse(raw) as Partial<PhotoRuling>;
    const lectura: PhotoReading[] = Array.isArray(parsed.lecturaPorFoto)
      ? parsed.lecturaPorFoto.map((row, i) => ({
          indice: Number(row.indice) || i + 1,
          descripcion: String(row.descripcion || "").trim(),
        }))
      : [];
    return {
      resumen: String(parsed.resumen || "").trim(),
      lecturaPorFoto: lectura.filter((r) => r.descripcion),
      hallazgos: Array.isArray(parsed.hallazgos)
        ? (parsed.hallazgos as PhotoFinding[]).map((h) => ({
            ...h,
            id: h.id || crypto.randomUUID(),
          }))
        : [],
      conformidades: Array.isArray(parsed.conformidades)
        ? parsed.conformidades.map(String)
        : [],
      limites: String(parsed.limites || "").trim(),
    };
  } catch {
    return {
      resumen: raw,
      lecturaPorFoto: [],
      hallazgos: [],
      conformidades: [],
      limites: "No se pudo estructurar la respuesta del modelo.",
    };
  }
}

function offlineRuling(hint: string, count: number) {
  return {
    resumen: `Modo demo (sin OPENAI_API_KEY). Hay ${count} foto(s) listas. Con la clave, el interventor lee cada imagen en detalle alto, cruza las notas de campo y cita RETIE / NTC 2050.`,
    lecturaPorFoto: [] as PhotoReading[],
    hallazgos: [
      {
        titulo: "Análisis pendiente de modelo de visión",
        criticidad: "observacion" as const,
        hechos: hint || "Hay fotografías cargadas, pero no se analizaron en vivo.",
        norma: "RETIE",
        articulo: "Verificar en edición vigente tras activar inteligencia.",
        fundamento:
          "Este OS necesita OPENAI_API_KEY para dictamen visual. El criterio humano no se sustituye.",
        accion: "Configure la clave y pulse Analizar de nuevo.",
      },
    ],
    conformidades: [] as string[],
    limites:
      "Sin visión en vivo no se afirma ninguna no conformidad. El dictamen ONAC sigue siendo del organismo de inspección.",
  };
}
