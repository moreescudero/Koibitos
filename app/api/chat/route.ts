import { NextResponse, type NextRequest } from "next/server";
import type { Content, Part } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getGemini, MODEL, functionDeclarations, systemPrompt } from "@/lib/gemini";
import { executeTool } from "@/lib/tools";
import { buildContext } from "@/lib/context";
import { isAllowed, senderForEmail } from "@/lib/allowed";

export const runtime = "nodejs";
export const maxDuration = 60; // segundos (Vercel Hobby permite hasta 60)

const MAX_ITERS = 5;
const HISTORY_LIMIT = 30;

export async function POST(req: NextRequest) {
  let body: { tripId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const tripId = body.tripId?.trim();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!tripId || !message) {
    return NextResponse.json({ error: "tripId y message son requeridos" }, { status: 400 });
  }

  // --- Auth: sesión del usuario logueado ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowed(user?.email)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const sender = senderForEmail(user!.email);

  // A partir de acá usamos el cliente con service role (bypassa RLS).
  const db = createServiceClient();

  // --- 1. Insertar el mensaje del usuario (dispara Realtime) ---
  const { error: insErr } = await db
    .from("messages")
    .insert({ trip_id: tripId, sender, content: message });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // --- 2. Armar contexto: historial + estado del itinerario ---
  const [historyRes, itemsRes, legsRes] = await Promise.all([
    db
      .from("messages")
      .select("sender, content, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    db
      .from("itinerary_items")
      .select("id, city, category, title, description")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    db
      .from("route_legs")
      .select("order_index, city, days_allocated, notes")
      .eq("trip_id", tripId)
      .order("order_index", { ascending: true }),
  ]);

  const context = buildContext(itemsRes.data ?? [], legsRes.data ?? []);

  const history = (historyRes.data ?? []).slice().reverse();
  const contents: Content[] = [];
  for (const m of history) {
    const role = m.sender === "gemini" ? "model" : "user";
    const text = m.sender === "gemini" ? m.content : `[${m.sender}] ${m.content}`;
    const last = contents[contents.length - 1];
    // Gemini exige alternar user/model: fusionar turnos consecutivos del mismo rol.
    if (last && last.role === role) {
      last.parts!.push({ text });
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }
  // La primera entrada tiene que ser del usuario.
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: `[${sender}] ${message}` }] });
  }

  // --- 3-4. Loop de function calling ---
  const ai = getGemini();
  let finalText = "";
  try {
    for (let i = 0; i < MAX_ITERS; i++) {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt(context),
          tools: [{ functionDeclarations }],
          // Sin "thinking": más rápido y no gasta cuota extra del free tier.
          // Subir a un budget > 0 si se quiere mejor razonamiento en los tools.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const text = res.text?.trim();
      if (text) finalText = text;

      const calls = res.functionCalls ?? [];
      if (calls.length === 0) break;

      // Turno del modelo con las function calls, tal cual vino.
      const modelContent = res.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      } else {
        contents.push({
          role: "model",
          parts: calls.map((c) => ({ functionCall: c })),
        });
      }

      // Ejecutar cada función y devolver los resultados.
      const parts: Part[] = [];
      for (const call of calls) {
        const out = await executeTool(db, tripId, call.name ?? "", call.args ?? {});
        parts.push({
          functionResponse: { name: call.name ?? "", response: { result: out } },
        });
      }
      contents.push({ role: "user", parts });
    }
  } catch (e) {
    console.error("[/api/chat] error de Gemini:", e);
    finalText = "Uy, tuve un problema para procesar eso. ¿Lo intentás de nuevo?";
  }

  if (!finalText) finalText = "Listo.";

  // --- 5. Guardar la respuesta del asistente (dispara Realtime) ---
  const { error: botErr } = await db
    .from("messages")
    .insert({ trip_id: tripId, sender: "gemini", content: finalText });
  if (botErr) {
    return NextResponse.json({ error: botErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
