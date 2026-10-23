import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { canAccessModule } from "@/lib/auth/roles";
import {
  CONTENT_BANK,
  CONTENT_PLAYBOOK,
  addDays,
  emptyPiece,
  mondayOf,
  seedWeekFromBank,
  type ContentPiece,
} from "@/lib/content";
import { composeSpecialistPrompt, getSpecialist } from "@/lib/specialists";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const custom = await listCustomRoles();
    if (!canAccessModule(session.role, "contenido", custom)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      weekStart?: string;
      note?: string;
      manual?: string;
    };
    const weekStart = mondayOf(body.weekStart);
    const specialist = getSpecialist("growth");
    if (!specialist) {
      return NextResponse.json({ error: "No está Daniela (Growth)." }, { status: 500 });
    }

    const fallback = seedWeekFromBank(weekStart);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await appendIntelligenceLog(session, {
        mode: "specialist",
        specialistLabel: specialist.title,
        question: `Semana ${weekStart}`,
        answer: "Modo demo: semana sembrada desde el banco de ideas.",
      });
      return NextResponse.json({
        weekStart,
        pieces: fallback,
        offline: true,
        note: "Sin OPENAI_API_KEY: usamos el banco de ideas. Configure la clave para que Daniela arme briefs nuevos.",
      });
    }

    const bankDigest = CONTENT_BANK.map(
      (i) =>
        `- ${i.id}: ${i.title} (${i.format}, ${i.objective}) — ${i.why}`
    ).join("\n");

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: composeSpecialistPrompt(
            specialist,
            [CONTENT_PLAYBOOK, body.manual?.trim()].filter(Boolean).join("\n\n")
          ),
        },
        {
          role: "user",
          content: `Arma la semana que empieza el lunes ${weekStart} para Genera Solutions SAS.
Equipo pequeño, ellos filman, 5 piezas (lun a vie). Sábado/domingo vacíos salvo que justifiques un Live.
Usa o varia el banco de ideas. Máximo UN objetivo "contacto" en la semana.
${body.note?.trim() ? `Pedido del equipo: ${body.note.trim()}` : ""}

Banco:
${bankDigest}

Responde SOLO JSON:
{
  "note": "una frase para el equipo",
  "pieces": [
    {
      "date": "YYYY-MM-DD",
      "format": "reel|short|historia|post|live",
      "network": "instagram|facebook|tiktok|youtube",
      "title": "",
      "hook": "",
      "script": "",
      "location": "",
      "durationSec": 30,
      "cta": "",
      "objective": "educar|confianza|contacto",
      "bankId": "id del banco o vacío"
    }
  ]
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { note?: string; pieces?: Partial<ContentPiece>[] } = {};
    try {
      parsed = JSON.parse(raw) as { note?: string; pieces?: Partial<ContentPiece>[] };
    } catch {
      parsed = {};
    }
    const pieces = (parsed.pieces ?? [])
      .map((p) =>
        emptyPiece({
          ...p,
          id: crypto.randomUUID(),
          status: "idea",
        })
      )
      .filter((p) => p.date >= weekStart && p.date <= addDays(weekStart, 6));

    const finalPieces = pieces.length ? pieces : fallback;
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: specialist.title,
      question: `Semana ${weekStart}`,
      answer: parsed.note || `${finalPieces.length} piezas`,
    });
    return NextResponse.json({
      weekStart,
      pieces: finalPieces,
      offline: false,
      note: parsed.note || "Semana lista para aprobar y grabar.",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo armar la semana: ${detail}` },
      { status: 500 }
    );
  }
}
