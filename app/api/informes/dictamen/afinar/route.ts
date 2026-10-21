import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import {
  withRetieManual,
  type PhotoRuling,
  type RulingPhoto,
} from "@/lib/photo-ruling";
import {
  PHOTO_REFINE_SYSTEM,
  rulingBriefForChat,
  type RefinePatch,
} from "@/lib/ruling-refine";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  message?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  findingIndex?: number;
  ruling?: PhotoRuling;
  focusPhoto?: Pick<RulingPhoto, "caption" | "dataUrl">;
  manuals?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = (await req.json()) as Body;
    const message = body.message?.trim();
    if (!message || !body.ruling) {
      return NextResponse.json(
        { error: "Falta el dictamen o el mensaje." },
        { status: 400 }
      );
    }

    const brief = rulingBriefForChat(body.ruling);
    const target =
      body.findingIndex != null && Number.isFinite(body.findingIndex)
        ? `Afina SOLO el hallazgo índice ${body.findingIndex} (0-based). Usa hallazgoParcial.`
        : "Puedes tocar síntesis, lecturas o varios hallazgos si el pedido lo exige.";

    const payload = `${target}

Dictamen actual:
${JSON.stringify(brief, null, 2)}

Pedido del inspector:
${message}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const reply =
        "Sin clave de inteligencia no puedo reescribir el punto. Edite a mano el hallazgo o configure OPENAI_API_KEY.";
      await appendIntelligenceLog(session, {
        mode: "specialist",
        specialistLabel: "Afinar dictamen RETIE",
        question: message,
        answer: reply,
      });
      return NextResponse.json({ reply, offline: true } satisfies RefinePatch & {
        offline: boolean;
      });
    }

    const client = new OpenAI({ apiKey });
    const history = (body.history ?? []).slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: payload },
    ];
    if (body.focusPhoto?.dataUrl?.startsWith("data:image")) {
      userContent.push({
        type: "text",
        text: `Imagen del hallazgo (${body.focusPhoto.caption || "foto"}).`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: body.focusPhoto.dataUrl, detail: "low" },
      });
    }

    const completion = await client.chat.completions.create({
      model:
        process.env.OPENAI_VISION_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: withRetieManual(PHOTO_REFINE_SYSTEM, body.manuals),
        },
        ...history,
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = parsePatch(raw);
    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: "Afinar dictamen RETIE",
      question: message,
      answer: parsed.reply,
    });
    return NextResponse.json({ ...parsed, offline: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo afinar el dictamen: ${detail}` },
      { status: 500 }
    );
  }
}

function parsePatch(raw: string): RefinePatch {
  try {
    const parsed = JSON.parse(raw) as RefinePatch;
    return {
      reply: String(parsed.reply || "Ajusté el dictamen. Revíselo a mano si hace falta."),
      resumen: parsed.resumen,
      lecturaPorFoto: parsed.lecturaPorFoto,
      hallazgos: parsed.hallazgos,
      hallazgoParcial: parsed.hallazgoParcial,
      conformidades: parsed.conformidades,
      limites: parsed.limites,
    };
  } catch {
    return { reply: raw };
  }
}
