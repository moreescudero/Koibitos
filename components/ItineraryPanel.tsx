"use client";

import { useMemo } from "react";
import {
  CATEGORY_LABEL,
  type Category,
  type ItineraryItem,
  type RouteLeg,
} from "@/lib/types";

interface Props {
  items: ItineraryItem[];
  legs: RouteLeg[];
}

const CATEGORY_STYLE: Record<Category, string> = {
  must_visit: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  shopping: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  food: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  note: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
};

export function ItineraryPanel({ items, legs }: Props) {
  // Orden de ciudades: primero las del recorrido (por order_index), después
  // cualquier otra ciudad con items, alfabética.
  const cityOrder = useMemo(() => {
    const order = new Map<string, number>();
    [...legs]
      .sort((a, b) => a.order_index - b.order_index)
      .forEach((l, i) => {
        if (!order.has(l.city)) order.set(l.city, i);
      });
    const extras = [...new Set(items.map((it) => it.city))]
      .filter((c) => !order.has(c))
      .sort((a, b) => a.localeCompare(b));
    extras.forEach((c, i) => order.set(c, legs.length + i));
    return order;
  }, [legs, items]);

  const itemsByCity = useMemo(() => {
    const map = new Map<string, ItineraryItem[]>();
    for (const it of items) {
      const arr = map.get(it.city) ?? [];
      arr.push(it);
      map.set(it.city, arr);
    }
    return map;
  }, [items]);

  const cities = [...cityOrder.keys()].sort(
    (a, b) => (cityOrder.get(a) ?? 0) - (cityOrder.get(b) ?? 0),
  );

  const totalDays = legs.reduce((s, l) => s + (l.days_allocated ?? 0), 0);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <span className="text-sm font-semibold">Itinerario</span>
        {totalDays > 0 && (
          <span className="text-xs text-neutral-500">{totalDays} días en total</span>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {legs.length > 0 && (
          <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Recorrido
            </h3>
            <ol className="space-y-1.5">
              {[...legs]
                .sort((a, b) => a.order_index - b.order_index)
                .map((l) => (
                  <li key={l.id} className="text-sm">
                    <span className="font-medium">
                      {l.order_index + 1}. {l.city}
                    </span>
                    {l.days_allocated != null && (
                      <span className="text-neutral-500"> · {l.days_allocated}d</span>
                    )}
                    {l.notes && (
                      <span className="block text-xs text-neutral-500">{l.notes}</span>
                    )}
                  </li>
                ))}
            </ol>
          </div>
        )}

        {cities.length === 0 && (
          <p className="text-sm text-neutral-500">
            Todavía no hay nada cargado. Escribí en el chat y esto se va llenando.
          </p>
        )}

        {cities.map((city) => {
          const cityItems = itemsByCity.get(city) ?? [];
          if (cityItems.length === 0 && !cityOrder.has(city)) return null;
          return (
            <div key={city}>
              <h3 className="mb-2 text-sm font-semibold">{city}</h3>
              {cityItems.length === 0 ? (
                <p className="text-xs text-neutral-400">Sin items todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {cityItems.map((it) => (
                    <li
                      key={it.id}
                      className="rounded-xl border border-neutral-200 p-2.5 dark:border-neutral-800"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_STYLE[it.category]}`}
                        >
                          {CATEGORY_LABEL[it.category]}
                        </span>
                        <span className="text-sm font-medium">{it.title}</span>
                      </div>
                      {it.description && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {it.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
