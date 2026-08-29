import { CATEGORY_LABEL, type Category } from "./types";

interface ItemRow {
  id: string;
  city: string;
  category: Category;
  title: string;
  description: string | null;
}

interface LegRow {
  order_index: number;
  city: string;
  days_allocated: number | null;
  notes: string | null;
}

/**
 * Serializa el estado del viaje (ruta + itinerario) a un texto compacto para
 * meter en el system prompt.
 */
export function buildContext(items: ItemRow[], legs: LegRow[]): string {
  const lines: string[] = [];

  lines.push("RECORRIDO (orden de ciudades):");
  if (legs.length === 0) {
    lines.push("  (todavía sin definir)");
  } else {
    for (const l of [...legs].sort((a, b) => a.order_index - b.order_index)) {
      const d = l.days_allocated != null ? `${l.days_allocated} día(s)` : "sin días";
      lines.push(`  ${l.order_index + 1}. ${l.city} — ${d}${l.notes ? ` — ${l.notes}` : ""}`);
    }
  }

  lines.push("");
  lines.push("ITINERARIO (items por ciudad):");
  if (items.length === 0) {
    lines.push("  (todavía sin items)");
  } else {
    const byCity = new Map<string, ItemRow[]>();
    for (const it of items) {
      const arr = byCity.get(it.city) ?? [];
      arr.push(it);
      byCity.set(it.city, arr);
    }
    for (const [city, arr] of byCity) {
      lines.push(`  ${city}:`);
      for (const it of arr) {
        const desc = it.description ? ` — ${it.description}` : "";
        lines.push(`    - [${CATEGORY_LABEL[it.category]}] ${it.title}${desc} (id ${it.id})`);
      }
    }
  }

  return lines.join("\n");
}
