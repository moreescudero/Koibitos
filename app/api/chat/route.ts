import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAnthropic, MODEL, tools, systemPrompt } from "@/lib/anthropic";
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
  const messages: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (m.sender === "claude") {
      messages.push({ role: "assistant", content: m.content });
    } else {
      messages.push({ role: "user", content: `[${m.sender}] ${m.content}` });
    }
  }
  // La primera entrada tiene que ser 'user'.
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length === 0) {
    messages.push({ role: "user", content: `[${sender}] ${message}` });
  }

  // --- 3-4. Loop de tool use ---
  const anthropic = getAnthropic();
  let finalText = "";
  try {
    for (let i = 0; i < MAX_ITERS; i++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt(context),
        tools,
        messages,
      });

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) finalText = text;

      const toolUses = res.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (res.stop_reason !== "tool_use" || toolUses.length === 0) break;

      messages.push({ role: "assistant", content: res.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const out = await executeTool(db, tripId, tu.name, tu.input);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error("[/api/chat] error de Anthropic:", e);
    finalText = "Uy, tuve un problema para procesar eso. ¿Lo intentás de nuevo?";
  }

  if (!finalText) finalText = "Listo.";

  // --- 5. Guardar la respuesta de Claude (dispara Realtime) ---
  const { error: claudeErr } = await db
    .from("messages")
    .insert({ trip_id: tripId, sender: "claude", content: finalText });
  if (claudeErr) {
    return NextResponse.json({ error: claudeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
