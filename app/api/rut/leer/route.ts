import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import {
  MAX_RUT_PHOTOS,
  RUT_SYSTEM,
  normalizeClientParty,
  type ClientPartyPhoto,
} from "@/lib/client-party";

export const runtime = "nodejs";
export const maxDuration = 90;

interface Body {
  photos?: ClientPartyPhoto[];
  pdfText?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = (await req.json()) as Body;
    const photos = (body.photos ?? [])
      .filter((p) => p.dataUrl?.startsWith("data:image"))
      .slice(0, MAX_RUT_PHOTOS);
    const pdfText = body.pdfText?.trim() || "";
    if (!photos.length && !pdfText) {
      return NextResponse.json(
        { error: "Suba al menos una foto o un PDF del RUT." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const party = normalizeClientParty(
        {
          extras:
            "Modo demo: configure OPENAI_API_KEY para leer el RUT. Complete los campos a mano.",
        },
        photos
      );
      return NextResponse.json({ party, offline: true });
    }

    const client = new OpenAI({ apiKey });
    const imageParts = photos.flatMap((p, i) => [
      { type: "text" as const, text: `— RUT página ${i + 1} —` },
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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: RUT_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Lea el RUT colombiano y extraiga identidad y responsabilidades tributarias.",
                pdfText
                  ? `Texto extraído del PDF:\n${pdfText.slice(0, 12000)}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
            ...imageParts,
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = { extras: raw };
    }
    const party = normalizeClientParty(parsed, photos);
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: "Lectura de RUT",
      question: `RUT ${photos.length} página(s)`,
      answer: `${party.legalName || "Sin razón social"} · NIT ${party.nit}${
        party.dv ? `-${party.dv}` : ""
      } · ${party.agenteRetenedorFuente ? "agente retenedor" : "sin retención fuente"}`,
    });
    return NextResponse.json({ party, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo leer el RUT: ${detail}` },
      { status: 500 }
    );
  }
}
