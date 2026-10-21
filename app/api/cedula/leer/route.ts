import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import type { ClientPartyPhoto } from "@/lib/client-party";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM = `Eres un verificador de identidad colombiano. Lees una cédula de ciudadanía (CC), cédula de extranjería o documento similar en foto o PDF.
Extrae solo lo que se ve. No inventes. Si un dato no aparece, deja "".

Campos JSON:
- fullName: nombres y apellidos como aparecen
- documentType: cc | ce | ppt | nit | otro
- documentNumber: números del documento, sin puntos ni espacios
- birthDate: si aparece
- extras: calidad de imagen u observaciones

Responde SOLO JSON con esas claves.`;

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
      .slice(0, 4);
    const pdfText = body.pdfText?.trim() || "";
    if (!photos.length && !pdfText) {
      return NextResponse.json(
        { error: "Suba al menos una foto o un PDF de la cédula." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        offline: true,
        reading: {
          fullName: "",
          documentType: "cc",
          documentNumber: "",
          extras: "Modo demo: complete a mano o configure OPENAI_API_KEY.",
        },
      });
    }

    const client = new OpenAI({ apiKey });
    const imageParts = photos.flatMap((p, i) => [
      { type: "text" as const, text: `— Cédula página ${i + 1} —` },
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
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Lea el documento de identidad y extraiga nombre y número.",
                pdfText
                  ? `Texto extraído del PDF:\n${pdfText.slice(0, 8000)}`
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
    const reading = {
      fullName: String(parsed.fullName || "").trim(),
      documentType: String(parsed.documentType || "cc").toLowerCase(),
      documentNumber: String(parsed.documentNumber || "").replace(/\D/g, ""),
      birthDate: String(parsed.birthDate || "").trim(),
      extras: String(parsed.extras || "").trim(),
    };
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: "Lectura de cédula",
      question: `Cédula ${photos.length} página(s)`,
      answer: `${reading.fullName || "Sin nombre"} · ${reading.documentType} ${reading.documentNumber || "—"}`,
    });
    return NextResponse.json({ reading, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo leer la cédula: ${detail}` },
      { status: 500 }
    );
  }
}
