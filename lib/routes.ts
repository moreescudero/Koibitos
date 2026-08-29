// Tabla estática de tiempos de viaje entre las ciudades del recorrido.
//
// IMPORTANTE: estos números son ESTIMACIONES de referencia, no datos definitivos.
// TODO: verificar cada valor en Google Maps / Navitime / Hyperdia antes de confiar
// en él para armar horarios reales. El modelo nunca inventa estas horas: siempre
// salen de acá.

export const CITIES = [
  "Tokio",
  "Fujiyoshida",
  "Hakone",
  "Takayama",
  "Shirakawa-go",
  "Kioto",
  "Osaka",
] as const;

export type City = (typeof CITIES)[number];

export interface Leg {
  from: City;
  to: City;
  /** Tiempo de viaje puerta a puerta, en minutos (aproximado). */
  minutes: number;
  /** Medio de transporte principal. */
  mode: string;
}

// Tramos conocidos. Se tratan como simétricos (A->B == B->A) salvo que se agregue
// la entrada inversa explícita.
// TODO: verificar TODOS estos tiempos y medios.
export const TRAVEL_TIMES: Leg[] = [
  { from: "Tokio", to: "Fujiyoshida", minutes: 110, mode: "tren Fuji Excursion / bus expreso" },
  { from: "Fujiyoshida", to: "Hakone", minutes: 100, mode: "bus + tren (via Gotemba)" },
  { from: "Hakone", to: "Takayama", minutes: 300, mode: "tren via Odawara y Nagoya (Hida)" },
  { from: "Takayama", to: "Shirakawa-go", minutes: 50, mode: "bus expreso Nohi" },
  { from: "Shirakawa-go", to: "Kioto", minutes: 220, mode: "bus a Kanazawa + tren Thunderbird" },
  { from: "Takayama", to: "Kioto", minutes: 200, mode: "tren Hida via Nagoya" },
  { from: "Kioto", to: "Osaka", minutes: 30, mode: "tren JR Special Rapid" },
  { from: "Tokio", to: "Kioto", minutes: 140, mode: "Shinkansen Nozomi" },
  { from: "Tokio", to: "Osaka", minutes: 165, mode: "Shinkansen Nozomi" },
  { from: "Hakone", to: "Kioto", minutes: 170, mode: "tren a Odawara + Shinkansen" },
];

const CITY_ALIASES: Record<string, City> = {
  tokio: "Tokio",
  tokyo: "Tokio",
  fujiyoshida: "Fujiyoshida",
  fuji: "Fujiyoshida",
  "monte fuji": "Fujiyoshida",
  "mt fuji": "Fujiyoshida",
  kawaguchiko: "Fujiyoshida",
  fujikawaguchiko: "Fujiyoshida",
  "lago kawaguchi": "Fujiyoshida",
  hakone: "Hakone",
  takayama: "Takayama",
  "shirakawa-go": "Shirakawa-go",
  shirakawago: "Shirakawa-go",
  "shirakawa go": "Shirakawa-go",
  shirakawa: "Shirakawa-go",
  kioto: "Kioto",
  kyoto: "Kioto",
  osaka: "Osaka",
};

const ACCENTS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
  "ō": "o",
  "ū": "u",
};

function stripAccents(s: string): string {
  return s.replace(/[áéíóúüñōū]/g, (c) => ACCENTS[c] ?? c);
}

/**
 * Normaliza el nombre de una ciudad (acentos, mayúsculas, variantes en inglés o
 * de escritura) a una de las claves canónicas de CITIES. Devuelve null si no se
 * reconoce.
 */
export function normalizeCity(input: string): City | null {
  const s = stripAccents(input.trim().toLowerCase());
  return CITY_ALIASES[s] ?? null;
}

/** Devuelve el tramo (en cualquier sentido) entre dos ciudades, o null. */
export function travelTime(from: string, to: string): Leg | null {
  const a = normalizeCity(from);
  const b = normalizeCity(to);
  if (!a || !b || a === b) return null;

  return (
    TRAVEL_TIMES.find(
      (l) => (l.from === a && l.to === b) || (l.from === b && l.to === a),
    ) ?? null
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Texto legible del tramo entre dos ciudades, para adjuntar a las notas de
 * route_legs. Devuelve null si no hay dato.
 */
export function formatTravelTime(from: string, to: string): string | null {
  const leg = travelTime(from, to);
  if (!leg) return null;
  return `Viaje ${from} -> ${to}: ~${formatDuration(leg.minutes)} en ${leg.mode} (aprox., verificar)`;
}
