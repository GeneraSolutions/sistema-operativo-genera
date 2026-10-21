import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import { composeMesaPrompt, type SpecialistId } from "@/lib/specialists";
import {
  REPORT_KIND_LABELS,
  briefingForMesa,
  type ReportChapter,
  type TechnicalReport,
} from "@/lib/technical-reports";

export const runtime = "nodejs";

interface Body {
  report: TechnicalReport;
  manuals?: Record<string, string>;
}

interface MesaJson {
  sintesis?: string;
  recomendaciones?: string;
  proximosPasos?: string;
  capitulos?: { specialistId?: string; body?: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = (await req.json()) as Body;
    if (!body.report?.kind) {
      return NextResponse.json(
        { error: "Falta el informe a redactar." },
        { status: 400 }
      );
    }

    const briefing = briefingForMesa(body.report);
    const system = `${composeMesaPrompt(body.manuals ?? {})}

Hoy no estás en modo chat: redactas un INFORME TÉCNICO de Genera Solutions SAS para entregar al cliente o al dueño de la planta. Nombre la empresa siempre “Genera Solutions SAS”.
Tono: formal, colombiano, de ingeniero (fotovoltaico, eléctrico, estructural, O&M, SST y RETIE según el capítulo).
No inventes mediciones numéricas que el inspector no escribió. Si falta un dato, indícalo como pendiente de campo.
No adules. Separa hechos, criterio y recomendación.
Responde SOLO JSON válido con esta forma:
{
  "sintesis": "2 a 4 párrafos de síntesis ejecutiva",
  "recomendaciones": "lista en texto de recomendaciones priorizadas",
  "proximosPasos": "pasos concretos para Genera Solutions SAS y para el cliente",
  "capitulos": [
    { "specialistId": "fotovoltaico", "body": "markdown del capítulo" }
  ]
}
Los specialistId deben coincidir con los capítulos pedidos. Cada body: 120-280 palabras.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const drafted = offlineDraft(body.report);
      await appendIntelligenceLog(session, {
        mode: "mesa",
        specialistLabel: `Informe · ${REPORT_KIND_LABELS[body.report.kind]}`,
        question: briefing.slice(0, 4000),
        answer: drafted.sintesis,
      });
      return NextResponse.json({ ...drafted, offline: true });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Redacte el informe con este briefing de campo:\n\n${briefing}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = parseMesa(raw);
    const merged = applyDraft(body.report, parsed);

    await appendIntelligenceLog(session, {
      mode: "mesa",
      specialistLabel: `Informe · ${REPORT_KIND_LABELS[body.report.kind]}`,
      question: briefing.slice(0, 4000),
      answer: merged.sintesis,
    });

    return NextResponse.json({ ...merged, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo redactar el informe: ${detail}` },
      { status: 500 }
    );
  }
}

function parseMesa(raw: string): MesaJson {
  try {
    return JSON.parse(raw) as MesaJson;
  } catch {
    return { sintesis: raw };
  }
}

function applyDraft(report: TechnicalReport, parsed: MesaJson) {
  const byId = new Map(
    (parsed.capitulos ?? [])
      .filter((c) => c.specialistId && c.body)
      .map((c) => [c.specialistId as SpecialistId, c.body as string])
  );
  const chapters: ReportChapter[] = report.chapters.map((ch) => ({
    ...ch,
    body: byId.get(ch.specialistId)?.trim() || ch.body,
    approved: false,
  }));
  return {
    sintesis: parsed.sintesis?.trim() || report.findings,
    recomendaciones: parsed.recomendaciones?.trim() || report.recommendations,
    proximosPasos: parsed.proximosPasos?.trim() || report.nextSteps,
    chapters,
  };
}

function offlineDraft(report: TechnicalReport) {
  const kind = REPORT_KIND_LABELS[report.kind];
  const plant = report.plant.clientName || "el predio inspeccionado";
  const chapters: ReportChapter[] = report.chapters.map((ch) => ({
    ...ch,
    approved: false,
    body: `## ${ch.title} (borrador demo)

Pendiente de OPENAI_API_KEY. Con la clave, la mesa redacta este capítulo con criterio de Genera Solutions SAS.

Hechos de campo a incorporar: ${report.findings || "sin hallazgos escritos todavía"}.
Checklist: ${report.checklist.filter((c) => c.status === "no").length} ítems en no conformidad, ${report.checklist.filter((c) => c.status === "ok").length} conformes.

El ingeniero debe completar mediciones, fotos y firmar antes de publicar.`,
  }));
  return {
    sintesis: `Informe ${kind} sobre ${plant} (${report.visitDate}). Este es un borrador local: configure OPENAI_API_KEY para que la mesa redonda redacte síntesis y capítulos con el criterio de FV, potencia, estructura, O&M, SST y RETIE.`,
    recomendaciones:
      "1. Completar datos de planta y checklist.\n2. Adjuntar fotos de hallazgos.\n3. Configurar la clave de inteligencia y volver a redactar.\n4. Revisar cada capítulo antes de publicar.",
    proximosPasos:
      "El inspector cierra campo; ingeniería revisa; se publica el PDF al cliente y queda en Archivo.",
    chapters,
    offline: true,
  };
}
