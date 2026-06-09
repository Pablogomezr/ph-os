import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const image = form.get("image") as File | null;
  if (!image) return NextResponse.json({ error: "No se recibió imagen." }, { status: 400 });

  const bytes = await image.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = (image.type || "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          {
            type: "text",
            text: `Esta es una foto de un medidor de energía eléctrica.
Extrae ÚNICAMENTE el número de la lectura actual del display (en kWh o la unidad que muestre).
Responde SOLO con JSON válido, sin texto extra:
{"reading": <número_decimal_sin_unidad>, "confidence": "high"|"medium"|"low", "unit": "kWh"}

Si el display no es legible o la imagen no muestra un medidor, responde:
{"reading": null, "confidence": "low", "unit": "kWh"}`,
          },
        ],
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  // Extract JSON from response (handle markdown code blocks if present)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ reading: null, confidence: "low", raw: text });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      reading: parsed.reading ?? null,
      confidence: parsed.confidence ?? "low",
      unit: parsed.unit ?? "kWh",
    });
  } catch {
    return NextResponse.json({ reading: null, confidence: "low", raw: text });
  }
}
