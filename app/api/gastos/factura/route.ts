import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { canAccessModule } from "@/lib/auth/roles";
import { appendIntelligenceLog } from "@/lib/intelligence-log";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM = `Eres el lector de facturas de compra de Genera Solutions SAS (Colombia).
Lees una foto o PDF de factura / remisión / ticket de compra.
Extrae solo lo que se ve. No inventes ítems. Si un dato no aparece, usa "".

Responde SOLO JSON:
{
  "supplier": "razón social o nombre del proveedor",
  "place": "ciudad o sucursal si aparece",
  "date": "YYYY-MM-DD si se puede; si no, ''",
  "notes": "observación corta",
  "lines": [
    {
      "name": "nombre del producto o servicio",
      "qty": 1,
      "unitPriceCOP": 0,
      "unit": "und",
      "categoryLabel": "grupo sugerido (ej. Cableado, Estructura, Ferretería, Protecciones)"
    }
  ],
  "totalCOP": 0
}

qty y unitPriceCOP en números. Si solo hay total de línea, divide. Moneda COP.`;

interface Body {
  imageDataUrl?: string;
  pdfText?: string;
  fileName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const custom = await listCustomRoles();
    if (!canAccessModule(session.role, "gastos", custom)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    const imageDataUrl = String(body.imageDataUrl || "");
    const pdfText = String(body.pdfText || "").trim();
    const isImage = imageDataUrl.startsWith("data:image");
    if (!isImage && !pdfText) {
      return NextResponse.json(
        { error: "Suba una foto de la factura o el texto de un PDF." },
        { status: 400 }
      );
    }
    if (isImage && imageDataUrl.length > 6_000_000) {
      return NextResponse.json(
        { error: "La imagen es muy pesada. Baje la resolución (máx. ~4 MB)." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        offline: true,
        reading: {
          supplier: "",
          place: "",
          date: "",
          notes: "Sin OPENAI_API_KEY: complete a mano.",
          lines: [],
          totalCOP: 0,
        },
      });
    }

    const client = new OpenAI({ apiKey });
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: [
          "Lea esta factura de compra y extraiga proveedor, fecha e ítems.",
          body.fileName ? `Archivo: ${body.fileName}` : "",
          pdfText ? `Texto del PDF:\n${pdfText.slice(0, 12000)}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];
    if (isImage) {
      content.push({
        type: "image_url",
        image_url: { url: imageDataUrl, detail: "high" },
      });
    }

    const completion = await client.chat.completions.create({
      model:
        process.env.OPENAI_VISION_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const linesRaw = Array.isArray(parsed.lines) ? parsed.lines : [];
    const lines = linesRaw
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          name: String(r.name || "").trim(),
          qty: Number(r.qty) > 0 ? Number(r.qty) : 1,
          unitPriceCOP: Math.max(0, Math.round(Number(r.unitPriceCOP) || 0)),
          unit: String(r.unit || "und").trim() || "und",
          categoryLabel: String(r.categoryLabel || "Compras").trim() || "Compras",
        };
      })
      .filter((l) => l.name)
      .slice(0, 60);

    const reading = {
      supplier: String(parsed.supplier || "").trim(),
      place: String(parsed.place || "").trim(),
      date: String(parsed.date || "").trim(),
      notes: String(parsed.notes || "").trim(),
      lines,
      totalCOP: Math.max(
        0,
        Math.round(
          Number(parsed.totalCOP) ||
            lines.reduce((s, l) => s + l.qty * l.unitPriceCOP, 0)
        )
      ),
    };

    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: "Gastos · factura",
      question: `Factura ${body.fileName || "sin nombre"}`,
      answer: `${reading.supplier || "Proveedor"} · ${reading.lines.length} ítems · ${reading.totalCOP}`,
    });

    return NextResponse.json({ reading, offline: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo leer la factura. Intente otra foto o complete a mano." },
      { status: 500 }
    );
  }
}
