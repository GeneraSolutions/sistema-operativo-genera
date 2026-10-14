import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import {
  PHOTO_RULING_SYSTEM,
  type PhotoFinding,
  type PhotoRuling,
} from "@/lib/photo-ruling";

export const runtime = "nodejs";

interface Body {
  imageDataUrl: string;
  caption?: string;
  siteNote?: string;
  inspector?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = (await req.json()) as Body;
    const image = body.imageDataUrl?.trim();
    if (!image?.startsWith("data:image")) {
      return NextResponse.json(
        { error: "Suba una fotografía válida." },
        { status: 400 }
      );
    }

    const hint = [
      body.inspector && `Inspector: ${body.inspector}`,
      body.siteNote && `Sitio / contexto: ${body.siteNote}`,
      body.caption && `Pie de foto: ${body.caption}`,
    ]
      .filter(Boolean)
      .join("\n");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const offline = offlineRuling(hint);
      await appendIntelligenceLog(session, {
        mode: "specialist",
        specialistLabel: "Dictamen fotográfico RETIE",
        question: hint || "Foto de campo",
        answer: offline.resumen,
      });
      return NextResponse.json({ ...offline, offline: true });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PHOTO_RULING_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analice la evidencia fotográfica.\n${hint || "Sin contexto adicional."}`,
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = parseDraft(raw);
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: "Dictamen fotográfico RETIE",
      question: hint || "Foto de campo",
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
  "resumen" | "hallazgos" | "conformidades" | "limites"
> {
  try {
    const parsed = JSON.parse(raw) as Partial<PhotoRuling>;
    return {
      resumen: String(parsed.resumen || "").trim(),
      hallazgos: Array.isArray(parsed.hallazgos)
        ? (parsed.hallazgos as PhotoFinding[])
        : [],
      conformidades: Array.isArray(parsed.conformidades)
        ? parsed.conformidades.map(String)
        : [],
      limites: String(parsed.limites || "").trim(),
    };
  } catch {
    return {
      resumen: raw,
      hallazgos: [],
      conformidades: [],
      limites: "No se pudo estructurar la respuesta del modelo.",
    };
  }
}

function offlineRuling(hint: string) {
  return {
    resumen:
      "Modo demo (sin OPENAI_API_KEY). Con la clave, el inspector virtual lee la foto y cita RETIE, NTC 2050 y, si aplica, NSR-10, RETILAP o SST.",
    hallazgos: [
      {
        titulo: "Análisis pendiente de modelo de visión",
        criticidad: "observacion" as const,
        hechos: hint || "Hay una fotografía cargada, pero no se analizó en vivo.",
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
