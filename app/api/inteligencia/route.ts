import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { appendIntelligenceLog } from "@/lib/intelligence-log";
import {
  PLAN_EJECUCION_HINT,
  composeMesaPrompt,
  composeSpecialistPrompt,
  getSpecialist,
  type SpecialistId,
} from "@/lib/specialists";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ChatBody {
  mode: "specialist" | "mesa";
  specialistId?: SpecialistId;
  /** consulta normal o plan de ejecución del proyecto */
  intent?: "consulta" | "plan";
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  manuals?: Partial<Record<SpecialistId, string>>;
  /** Foto / página de PDF como data URL para visión */
  imageDataUrl?: string;
  /** Texto extraído de PDF u OCR local */
  pdfText?: string;
  fileName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = (await req.json()) as ChatBody;
    const message = body.message?.trim();
    const intent = body.intent === "plan" ? "plan" : "consulta";
    const imageDataUrl = String(body.imageDataUrl || "");
    const pdfText = String(body.pdfText || "").trim();
    const isImage = imageDataUrl.startsWith("data:image");

    if (!message) {
      return NextResponse.json(
        { error: "El mensaje es obligatorio." },
        { status: 400 }
      );
    }
    if (isImage && imageDataUrl.length > 6_000_000) {
      return NextResponse.json(
        { error: "La imagen es muy pesada. Baje la resolución (máx. ~4 MB)." },
        { status: 400 }
      );
    }

    const manuals = body.manuals ?? {};
    let systemPrompt = composeMesaPrompt(manuals);
    let label = "Mesa Redonda";

    if (body.mode === "specialist") {
      if (!body.specialistId) {
        return NextResponse.json(
          { error: "Debe indicar el especialista." },
          { status: 400 }
        );
      }
      const specialist = getSpecialist(body.specialistId);
      if (!specialist) {
        return NextResponse.json(
          { error: "Especialista no encontrado." },
          { status: 404 }
        );
      }
      systemPrompt = composeSpecialistPrompt(
        specialist,
        manuals[specialist.id]
      );
      label = specialist.title;
    }

    if (intent === "plan") {
      systemPrompt = `${systemPrompt}\n\n${PLAN_EJECUCION_HINT}`;
      if (body.mode === "mesa") label = "Mesa · Plan de ejecución";
      else label = `${label} · Plan`;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const reply = buildOfflineReply(label, message, body.mode, intent);
      await appendIntelligenceLog(session, {
        mode: body.mode,
        specialistLabel: label,
        question: message,
        answer: reply,
      });
      return NextResponse.json({
        reply,
        offline: true,
        label,
      });
    }

    const client = new OpenAI({ apiKey });
    const history = (body.history ?? []).slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const userText = [
      message,
      body.fileName ? `Archivo adjunto: ${body.fileName}` : "",
      pdfText ? `Texto extraído del PDF/documento:\n${pdfText.slice(0, 12000)}` : "",
      intent === "plan"
        ? "---\nEntrega plan de ejecución detallado + datos básicos que necesitas. Si falta información crítica, pregunta."
        : "---\nResponde con rigor de ingeniería (unidades, supuestos, normas). Si no sabes o faltan datos, pregunta. Evita generalidades.",
      isImage || pdfText
        ? "Hay evidencia adjunta: úsala y di qué se ve / qué no se puede concluir."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: userText },
    ];
    if (isImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageDataUrl, detail: "high" },
      });
    }

    const completion = await client.chat.completions.create({
      model:
        process.env.OPENAI_VISION_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-4o",
      temperature: 0.25,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userContent },
      ],
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "No se obtuvo respuesta del modelo.";

    await appendIntelligenceLog(session, {
      mode: body.mode,
      specialistLabel: label,
      question: body.fileName ? `${message} [${body.fileName}]` : message,
      answer: reply,
    });

    return NextResponse.json({ reply, offline: false, label });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `Error al consultar inteligencia: ${detail}` },
      { status: 500 }
    );
  }
}

function buildOfflineReply(
  label: string,
  message: string,
  mode: "specialist" | "mesa",
  intent: "consulta" | "plan"
): string {
  const header =
    mode === "mesa"
      ? `## Mesa Redonda${intent === "plan" ? " · Plan de ejecución" : ""} (modo demo — sin OPENAI_API_KEY)`
      : `## ${label} (modo demo — sin OPENAI_API_KEY)`;

  return `${header}

Consulta recibida:
> ${message}

### Datos básicos que necesitamos
1. Ciudad / departamento y operador de red
2. Tipo de proyecto (cubierta, suelo, pérgola) + fotos
3. Consumo kWh/mes o tarifa COP/kWh
4. Potencia objetivo (kWp) o área disponible
5. ¿BESS? ¿AGPE / venta de excedentes?
6. Restricciones de obra (acceso, horario, altura)

### Plan de ejecución (esqueleto)
1. Levantamiento y datos
2. Ingeniería FV + potencia + estructura + unifilar
3. Trámites OR / CREG / UPME según aplique
4. Compras y lead time
5. Obra (SST → DC → AC → pruebas)
6. Dictamen RETIE, entrega y O&M

Configure \`OPENAI_API_KEY\` en \`.env.local\` (recomendado \`OPENAI_MODEL=gpt-4o\`) para asesoría en vivo con adjuntos.`;
}
