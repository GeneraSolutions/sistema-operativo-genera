import OpenAI, { toFile } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { canAccessModule } from "@/lib/auth/roles";
import { CONTENT_PLAYBOOK } from "@/lib/content";
import {
  emptyAnalysisPiece,
  fetchLinkPreview,
  mediaHostAllowed,
  parsePublicVideoUrl,
  publicLinkPreview,
  type LinkAnalysis,
} from "@/lib/content-link";
import { composeSpecialistPrompt, getSpecialist } from "@/lib/specialists";

export const runtime = "nodejs";
export const maxDuration = 60;

async function transcribeMedia(client: OpenAI, mediaUrl: string): Promise<string> {
  try {
    const host = new URL(mediaUrl).hostname;
    if (!mediaHostAllowed(host)) return "";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(mediaUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GeneraSolutionsBot/1.0; +https://www.generasolutions.com.co)",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const type = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 8000 || buf.byteLength > 12_000_000) return "";
    const ext = type.includes("webm") ? "webm" : "mp4";
    const file = await toFile(Buffer.from(buf), `clip.${ext}`);
    const out = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "es",
    });
    return String(out.text || "").replace(/\s+/g, " ").trim().slice(0, 8000);
  } catch {
    return "";
  }
}

function asList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function fallbackAnalysis(preview: Awaited<ReturnType<typeof fetchLinkPreview>>): LinkAnalysis {
  return {
    audiovisual: [
      "Gancho en los primeros 3 s, a cámara o con texto grande. Sin intro de logo.",
      "Plano estable; si hay techo, se ve anclaje o tablero, no un travelling mareado.",
      "Audio primero: si el viento tapa, subtítulos.",
    ],
    speech: [
      "Una idea por pieza. No lea un ensayo.",
      "Español de visita, no de comercial de TV.",
    ],
    claims: [
      "Si el video promete quitarse la factura, kWh mágicos o ‘la mitad regalada’, no lo copien.",
    ],
    keep: [
      "Quédense con el tema (recibo, techo, mito), no con las frases ni la música.",
    ],
    saidSummary: "Tema solar en redes. No copien el original: arman la versión Genera.",
    trends: [
      "Texto en pantalla + corte cada 2–3 s + pregunta al inicio sigue reteniendo en Reels/Shorts.",
    ],
    retention: [
      "Abra con la objeción del cliente. Cierre con una sola acción.",
    ],
    location: "Oficina, visita (con permiso) o tablero de planta: lo que el tema pida, sin set caro.",
    nextIdeas: [
      "Misma objeción, ustedes en el techo.",
      "Versión 15 s solo con el error de lo que dice la competencia.",
      "Historia: ‘esto no lo prometemos’ + NIT en pantalla.",
    ],
    note: preview.note || "Sin OPENAI_API_KEY: checklist local. Con la clave, Daniela reescribe el guion.",
    limited: true,
    piece: {
      ...emptyAnalysisPiece(),
      title: preview.title || "Versión Genera de este tema",
      hook: "Si alguien te prometió eso en un Reel, párate aquí.",
      script:
        "A cámara: el tema del video original, dicho con la doctrina de Genera Solutions SAS. Sin kWh inventados. Cierre con una sola frase útil.",
      location: "Cámara al frente o visita",
      cta: "Guarda esto. Cotizamos con recibo y techo, no con un Reel ajeno.",
    },
  };
}

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
      url?: string;
      notes?: string;
      manual?: string;
    };
    const url = String(body.url || "").trim();
    if (!parsePublicVideoUrl(url)) {
      return NextResponse.json(
        {
          error:
            "Pegue un enlace https de Instagram, TikTok, YouTube, Facebook o LinkedIn.",
        },
        { status: 400 }
      );
    }

    const specialist = getSpecialist("growth");
    if (!specialist) {
      return NextResponse.json({ error: "No está Daniela (Growth)." }, { status: 500 });
    }

    const preview = await fetchLinkPreview(url);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const analysis = fallbackAnalysis(preview);
      await appendIntelligenceLog(session, {
        mode: "specialist",
        specialistLabel: specialist.title,
        question: `Enlace ${url}`,
        answer: analysis.note,
      });
      return NextResponse.json({
        preview: publicLinkPreview(preview),
        analysis,
        offline: true,
      });
    }

    const client = new OpenAI({ apiKey });
    if (preview.spokenText.length < 40 && preview.mediaUrl) {
      const voice = await transcribeMedia(client, preview.mediaUrl);
      if (voice.length > 20) {
        preview.spokenText = voice;
        preview.spokenSource = "voz-whisper";
        preview.note = "Daniela pasó el audio a texto. No transcriban nada.";
      }
    }

    const heard = preview.spokenText.trim();
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.55,
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
          content: `Analiza este video de redes como referencia para Genera Solutions SAS.
El equipo NO transcribe. Tú ya tienes voz a texto o subtítulos o el texto del post.
NO copies el guion ni lo pegues. Extrae el tema y reescribe una pieza NUEVA, más honesta y más retenedora.
Si el texto automático es corto, limited=true, pero igual entrega guion Genera con el tema.

Enlace: ${preview.url}
Plataforma: ${preview.platform}
Título: ${preview.title || "(no hubo)"}
Autor: ${preview.author || "(no hubo)"}
Fuente del texto: ${preview.spokenSource || "ninguna"}
Texto automático (voz/subtítulos/post), úsalo como lo que dice el video:
${heard || "(no hubo audio ni subtítulos)"}
Contexto del equipo (NO es transcripción del video):
${body.notes?.trim() || "(nada)"}

Responde SOLO JSON:
{
  "limited": false,
  "saidSummary": "2 o 3 frases: de qué habla, sin copiar el original",
  "audiovisual": ["errores o mejoras de plano, luz, texto, ritmo, audio"],
  "speech": ["manera de hablar: ritmo, muletillas, tono, claridad"],
  "claims": ["lo que dice mal o peligroso: kWh, factura, ley, garantía"],
  "keep": ["qué sí vale la pena del enfoque, sin copiar"],
  "trends": ["qué de este formato está reteniendo ahora en Reels/Shorts Colombia solar"],
  "retention": ["cómo mejorar retención de audiencia y de cliente serio (recibo+techo)"],
  "location": "dónde filmarlo ustedes (visita, tablero, oficina Bogotá, bodega…)",
  "nextIdeas": ["3 variaciones distintas, no clones"],
  "note": "una frase al equipo",
  "piece": {
    "title": "",
    "hook": "gancho 3 s",
    "script": "guion 20-40 s, voz Genera, listo para grabar",
    "format": "reel",
    "network": "instagram",
    "durationSec": 30,
    "cta": "sin WhatsApp salvo que el original sea de contacto",
    "objective": "educar",
    "location": ""
  }
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: Partial<LinkAnalysis> = {};
    try {
      parsed = JSON.parse(raw) as Partial<LinkAnalysis>;
    } catch {
      parsed = {};
    }

    const base = fallbackAnalysis(preview);
    const piece = { ...base.piece, ...(parsed.piece || {}) };
    const analysis: LinkAnalysis = {
      audiovisual: asList(parsed.audiovisual).length
        ? asList(parsed.audiovisual)
        : base.audiovisual,
      speech: asList(parsed.speech).length ? asList(parsed.speech) : base.speech,
      claims: asList(parsed.claims).length ? asList(parsed.claims) : base.claims,
      keep: asList(parsed.keep).length ? asList(parsed.keep) : base.keep,
      saidSummary: String(parsed.saidSummary || base.saidSummary),
      trends: asList(parsed.trends).length ? asList(parsed.trends) : base.trends,
      retention: asList(parsed.retention).length
        ? asList(parsed.retention)
        : base.retention,
      location: String(parsed.location || piece.location || base.location),
      nextIdeas: asList(parsed.nextIdeas).length
        ? asList(parsed.nextIdeas)
        : base.nextIdeas,
      note: String(parsed.note || "Listo. Sumen la pieza al día si el guion sirve."),
      limited: Boolean(parsed.limited) || heard.length < 40,
      piece: {
        ...emptyAnalysisPiece(),
        ...piece,
        title: String(piece.title || "").slice(0, 120),
        hook: String(piece.hook || ""),
        script: String(piece.script || ""),
        format: piece.format || "reel",
        network: piece.network || "instagram",
        durationSec: Math.max(8, Number(piece.durationSec) || 30),
        cta: String(piece.cta || ""),
        objective: piece.objective || "educar",
        location: String(piece.location || parsed.location || ""),
      },
    };

    await appendIntelligenceLog(session, {
      mode: "specialist",
      specialistLabel: specialist.title,
      question: `Enlace ${preview.url}`,
      answer: analysis.note,
    });

    return NextResponse.json({
      preview: publicLinkPreview(preview),
      analysis,
      offline: false,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo analizar el enlace: ${detail}` },
      { status: 500 }
    );
  }
}
