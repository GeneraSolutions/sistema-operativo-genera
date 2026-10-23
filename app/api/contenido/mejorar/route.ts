import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { canAccessModule } from "@/lib/auth/roles";
import { CONTENT_PLAYBOOK, sanitizePiece, type ContentPiece } from "@/lib/content";
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
      piece?: Partial<ContentPiece>;
      instruction?: string;
      manual?: string;
    };
    const current = sanitizePiece(body.piece);
    const instruction = String(body.instruction || "").trim();
    if (!current) {
      return NextResponse.json({ error: "No hay pieza para mejorar." }, { status: 400 });
    }
    if (instruction.length < 4) {
      return NextResponse.json(
        { error: "Escriba qué no le gusta o cómo quiere mejorarla." },
        { status: 400 }
      );
    }

    const specialist = getSpecialist("growth");
    if (!specialist) {
      return NextResponse.json({ error: "No está Daniela (Growth)." }, { status: 500 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const piece = {
        ...current,
        hook: `${current.hook} (más directo, 3 s).`.slice(0, 220),
        script: `${current.script}\n\nAjuste pedido: ${instruction}`.slice(0, 2000),
        notes: [current.notes, `Pedido: ${instruction}`].filter(Boolean).join(" · "),
        updatedAt: new Date().toISOString(),
      };
      await appendIntelligenceLog(session, {
        mode: "specialist",
        specialistLabel: specialist.title,
        question: `Mejorar ${current.title}: ${instruction}`,
        answer: "Sin OPENAI_API_KEY: se anotó el pedido en la pieza.",
      });
      return NextResponse.json({
        piece,
        note: "Sin clave de OpenAI: quedó el pedido en la pieza. Con la clave, Daniela reescribe al instante.",
        offline: true,
      });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.45,
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
          content: `Mejora ESTA pieza. El equipo dijo qué no le gusta. Reescribe al instante. Conserva el tema salvo que pidan cambiarlo. No clones un Reel ajeno. No inventes kWh ni “te quitas la factura”. Nombre legal Genera Solutions SAS.

Pedido del equipo:
${instruction}

Pieza actual:
${JSON.stringify(
  {
    title: current.title,
    format: current.format,
    network: current.network,
    objective: current.objective,
    hook: current.hook,
    script: current.script,
    location: current.location,
    durationSec: current.durationSec,
    cta: current.cta,
    caption: current.caption,
    firstComment: current.firstComment,
    shots: current.shots,
    owner: current.owner,
  },
  null,
  2
)}

Responde SOLO JSON:
{
  "note": "una frase: qué cambió",
  "piece": {
    "title": "",
    "hook": "",
    "script": "",
    "location": "",
    "durationSec": 30,
    "cta": "",
    "caption": "",
    "firstComment": "",
    "shots": "",
    "format": "reel",
    "network": "instagram",
    "objective": "educar"
  }
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { note?: string; piece?: Partial<ContentPiece> } = {};
    try {
      parsed = JSON.parse(raw) as { note?: string; piece?: Partial<ContentPiece> };
    } catch {
      parsed = {};
    }

    const merged = sanitizePiece({
      ...current,
      ...parsed.piece,
      id: current.id,
      date: current.date,
      status: current.status,
      clientOk: current.clientOk,
      publishedUrl: current.publishedUrl,
      views: current.views,
      likes: current.likes,
      comments: current.comments,
      conversations: current.conversations,
      owner: parsed.piece?.owner || current.owner,
      notes: [current.notes, `Pedido: ${instruction}`].filter(Boolean).join(" · "),
      updatedAt: new Date().toISOString(),
    });

    const note =
      parsed.note?.trim() || "Listo. Revisen gancho, guion y caption.";
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: specialist.title,
      question: `Mejorar ${current.title}: ${instruction}`,
      answer: note,
    });
    return NextResponse.json({ piece: merged, note, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo mejorar la pieza: ${detail}` },
      { status: 500 }
    );
  }
}
