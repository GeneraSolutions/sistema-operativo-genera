import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  MESA_REDONDA_PROMPT,
  getSpecialist,
  type SpecialistId,
} from "@/lib/specialists";

export const runtime = "nodejs";

interface ChatBody {
  mode: "specialist" | "mesa";
  specialistId?: SpecialistId;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "El mensaje es obligatorio." },
        { status: 400 }
      );
    }

    let systemPrompt = MESA_REDONDA_PROMPT;
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
      systemPrompt = specialist.systemPrompt;
      label = specialist.title;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: buildOfflineReply(label, message, body.mode),
        offline: true,
        label,
      });
    }

    const client = new OpenAI({ apiKey });
    const history = (body.history ?? []).slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "No se obtuvo respuesta del modelo.";

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
  mode: "specialist" | "mesa"
): string {
  const header =
    mode === "mesa"
      ? "## Mesa Redonda (modo demo — sin OPENAI_API_KEY)"
      : `## ${label} (modo demo — sin OPENAI_API_KEY)`;

  return `${header}

Consulta recibida:
> ${message}

### Orientación preliminar (Colombia)

1. **Alcance técnico:** valide potencia (kWp), tipo de montaje y si requiere BESS.
2. **Regulatorio:** clasifique AGPE / AGGE según CREG 174 y gestione conexión con el Operador de Red.
3. **Estructural / civil:** verifique NSR-10, estado de cubierta o estudio de suelos.
4. **Tributario:** evalúe Ley 1715 (deducción 50%, IVA/aranceles, depreciación acelerada) con su contador.
5. **Contractual:** defina esquema EPC o PPA con salvaguardas y plazos.

Configure \`OPENAI_API_KEY\` en \`.env.local\` para respuestas generadas por el especialista en tiempo real.
Puede exportar estos parámetros al **Cotizador** para dimensionar CAPEX.`;
}
