import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "./types";
import { formatTravelTime } from "./routes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORIES: Category[] = ["must_visit", "shopping", "food", "note"];

export function looksLikeUuid(s: unknown): boolean {
  return typeof s === "string" && UUID_RE.test(s.trim());
}

// ---- add_itinerary_item -----------------------------------------------------

export interface AddItemInput {
  city: string;
  category: Category;
  title: string;
  description: string | null;
}

/** Valida y normaliza el input de add_itinerary_item. Tira Error con texto legible. */
export function validateAddInput(raw: unknown): AddItemInput {
  const o = (raw ?? {}) as Record<string, unknown>;
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const category = o.category as Category;
  const description =
    typeof o.description === "string" && o.description.trim()
      ? o.description.trim()
      : null;

  if (!city) throw new Error("falta 'city'");
  if (!title) throw new Error("falta 'title'");
  if (!CATEGORIES.includes(category)) {
    throw new Error(
      `'category' inválida: ${JSON.stringify(o.category)} (debe ser una de ${CATEGORIES.join(", ")})`,
    );
  }
  return { city, category, title, description };
}

// ---- set_route_order ------------------------------------------------------

export interface RouteLegInput {
  city: string;
  days_allocated: number;
  notes?: string;
}

export interface BuiltRouteLeg {
  order_index: number;
  city: string;
  days_allocated: number;
  notes: string | null;
}

/**
 * Convierte la lista de legs de la tool en filas listas para insertar:
 * agrega order_index correlativo y adjunta a `notes` el tiempo de viaje real
 * desde la ciudad anterior (si existe en la tabla de rutas). Función pura.
 */
export function buildRouteLegs(raw: unknown): BuiltRouteLeg[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("'legs' tiene que ser un array con al menos una ciudad");
  }

  return raw.map((entry, i) => {
    const o = (entry ?? {}) as Record<string, unknown>;
    const city = typeof o.city === "string" ? o.city.trim() : "";
    const days =
      typeof o.days_allocated === "number"
        ? Math.round(o.days_allocated)
        : Number.parseInt(String(o.days_allocated), 10);

    if (!city) throw new Error(`leg #${i + 1}: falta 'city'`);
    if (!Number.isFinite(days) || days < 0) {
      throw new Error(`leg #${i + 1} (${city}): 'days_allocated' inválido`);
    }

    const parts: string[] = [];
    if (typeof o.notes === "string" && o.notes.trim()) parts.push(o.notes.trim());
    if (i > 0) {
      const prev = (raw[i - 1] as Record<string, unknown>)?.city;
      const leg = typeof prev === "string" ? formatTravelTime(prev, city) : null;
      if (leg) parts.push(leg);
    }

    return {
      order_index: i,
      city,
      days_allocated: days,
      notes: parts.length ? parts.join(" — ") : null,
    };
  });
}

// ---- executor ------------------------------------------------------------

/**
 * Ejecuta un tool_use contra Supabase (cliente con service role) y devuelve un
 * texto de resultado para mandarle de vuelta al modelo como functionResponse.
 * Nunca tira: los errores vuelven como string.
 */
export async function executeTool(
  db: SupabaseClient,
  tripId: string,
  name: string,
  input: unknown,
): Promise<string> {
  try {
    switch (name) {
      case "add_itinerary_item": {
        const item = validateAddInput(input);
        const { data, error } = await db
          .from("itinerary_items")
          .insert({ trip_id: tripId, ...item })
          .select("id, title, city")
          .single();
        if (error) throw new Error(error.message);
        return `Agregado "${data.title}" en ${data.city} (id ${data.id}).`;
      }

      case "remove_itinerary_item": {
        const ref = (input as { item_id?: unknown })?.item_id;
        if (typeof ref !== "string" || !ref.trim()) {
          throw new Error("falta 'item_id'");
        }

        if (looksLikeUuid(ref)) {
          const { data, error } = await db
            .from("itinerary_items")
            .delete()
            .eq("trip_id", tripId)
            .eq("id", ref.trim())
            .select("title");
          if (error) throw new Error(error.message);
          if (!data || data.length === 0) return `No encontré ningún item con id ${ref}.`;
          return `Eliminado "${data[0].title}".`;
        }

        // Buscar por título aproximado.
        const { data: matches, error: findErr } = await db
          .from("itinerary_items")
          .select("id, title")
          .eq("trip_id", tripId)
          .ilike("title", `%${ref.trim()}%`);
        if (findErr) throw new Error(findErr.message);
        if (!matches || matches.length === 0) {
          return `No encontré ningún item que coincida con "${ref}".`;
        }
        if (matches.length > 1) {
          return `Hay varios items que coinciden con "${ref}": ${matches
            .map((m) => `${m.title} (${m.id})`)
            .join("; ")}. Pedí cuál sacar por id.`;
        }
        const { error: delErr } = await db
          .from("itinerary_items")
          .delete()
          .eq("trip_id", tripId)
          .eq("id", matches[0].id);
        if (delErr) throw new Error(delErr.message);
        return `Eliminado "${matches[0].title}".`;
      }

      case "set_route_order": {
        const legs = buildRouteLegs((input as { legs?: unknown })?.legs);

        const { error: delErr } = await db
          .from("route_legs")
          .delete()
          .eq("trip_id", tripId);
        if (delErr) throw new Error(delErr.message);

        const { error: insErr } = await db
          .from("route_legs")
          .insert(legs.map((l) => ({ trip_id: tripId, ...l })));
        if (insErr) throw new Error(insErr.message);

        return `Recorrido actualizado: ${legs
          .map((l) => `${l.city} (${l.days_allocated}d)`)
          .join(" -> ")}.`;
      }

      default:
        return `Error: tool desconocido "${name}".`;
    }
  } catch (e) {
    return `Error ejecutando ${name}: ${(e as Error).message}`;
  }
}
