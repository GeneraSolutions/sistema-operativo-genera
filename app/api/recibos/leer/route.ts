import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import {
  ENERGY_BILL_SYSTEM,
  MAX_BILL_PHOTOS,
  normalizeEnergyBill,
  type EnergyBillPhoto,
} from "@/lib/energy-bill";

export const runtime = "nodejs";
export const maxDuration = 90;

interface Body {
  photos?: EnergyBillPhoto[];
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
      .slice(0, MAX_BILL_PHOTOS);
    if (!photos.length) {
      return NextResponse.json(
        { error: "Suba al menos una foto del recibo." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const bill = normalizeEnergyBill(
        {
          extras:
            "Modo demo: configure OPENAI_API_KEY para leer el recibo. Complete los campos a mano.",
        },
        photos
      );
      return NextResponse.json({ bill, offline: true });
    }

    const client = new OpenAI({ apiKey });
    const imageParts = photos.flatMap((p, i) => [
      { type: "text" as const, text: `— Recibo foto ${i + 1} —` },
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
        { role: "system", content: ENERGY_BILL_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Lea ${photos.length} foto(s) de un recibo de energía colombiano y extraiga los campos. Sea literal con números de transformador, circuito, kWh y $/kWh.`,
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
    const bill = normalizeEnergyBill(parsed, photos);
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: "Lectura de recibo de energía",
      question: `Recibo ${photos.length} foto(s)`,
      answer: `${bill.utility || "Empresa"} · ${bill.consumptionKWh} kWh · ${bill.effectiveTariffCOPPerKWh} $/kWh`,
    });
    return NextResponse.json({ bill, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo leer el recibo: ${detail}` },
      { status: 500 }
    );
  }
}
