import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { canAccessModule } from "@/lib/auth/roles";
import {
  CONTENT_PLAYBOOK,
  emptyWeekReport,
  mondayOf,
  sanitizeWeekReport,
  type ContentPiece,
  type ContentWeekReport,
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
      report?: Partial<ContentWeekReport>;
      pieces?: ContentPiece[];
      manual?: string;
    };
    const report = sanitizeWeekReport({
      ...emptyWeekReport(mondayOf(body.report?.weekStart)),
      ...body.report,
    });
    if (!report) {
      return NextResponse.json({ error: "Falta la semana." }, { status: 400 });
    }

    const specialist = getSpecialist("growth");
    if (!specialist) {
      return NextResponse.json({ error: "No está Daniela (Growth)." }, { status: 500 });
    }

    const published = (body.pieces ?? []).filter((p) => p.status === "publicado");
    const delta = report.followersEnd - report.followersStart;
    const digest = published
      .map(
        (p) =>
          `- ${p.date} ${p.title}: ${p.views} vistas, ${p.likes} likes, ${p.comments} comentarios, ${p.conversations} recibos/visitas`
      )
      .join("\n");

    const fallback = `Semana ${report.weekStart}. Seguidores ${report.followersStart} → ${report.followersEnd} (${delta >= 0 ? "+" : ""}${delta}). Lo más visto: ${report.topTitle || "sin dato"} (${report.topViews} vistas, ${report.topLikes} likes, ${report.topComments} comentarios). Recibos/visitas: ${report.conversations}.
Repitan el formato del video top. No suban frecuencia: mejoren gancho y una sola idea. El número que importa es recibos, no likes.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await appendIntelligenceLog(session, {
        mode: "specialist",
        specialistLabel: specialist.title,
        question: `Rendimiento ${report.weekStart}`,
        answer: fallback,
      });
      return NextResponse.json({
        report: { ...report, analysis: fallback, updatedAt: new Date().toISOString() },
        offline: true,
      });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
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
          content: `El equipo pegó los números de Meta/TikTok/YouTube (no hay API). Interpreta la semana y di qué repetir, qué parar y qué filmar la próxima. Corto, accionable, sin humo.

Semana lunes ${report.weekStart}
Seguidores inicio ${report.followersStart} / cierre ${report.followersEnd} (delta ${delta})
Video que ellos marcan como top: ${report.topTitle || "—"} · ${report.topViews} vistas · ${report.topLikes} likes · ${report.topComments} comentarios
Conversiones (recibos o visitas): ${report.conversations}
Nota del equipo: ${report.note || "—"}

Piezas publicadas en el OS:
${digest || "(no marcaron publicado con números)"}

Responde en español colombiano, 4 bloques:
## Qué funcionó
## Qué no
## Una hipótesis (retención o mensaje)
## Próxima semana (3 piezas, no 10)`,
        },
      ],
    });

    const analysis =
      completion.choices[0]?.message?.content?.trim() || fallback;
    const next: ContentWeekReport = {
      ...report,
      analysis,
      updatedAt: new Date().toISOString(),
    };
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: specialist.title,
      question: `Rendimiento ${report.weekStart}`,
      answer: analysis.slice(0, 500),
    });
    return NextResponse.json({ report: next, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo leer el rendimiento: ${detail}` },
      { status: 500 }
    );
  }
}
