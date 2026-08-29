import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";

// Modelo del spec: gratis en el free tier de aistudio.google.com, con function calling.
export const MODEL = "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;

/** Cliente Gemini (lazy: no se crea en build time). Toma GEMINI_API_KEY del entorno. */
export function getGemini(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
}

/**
 * Declaraciones de las 3 funciones (function calling). Los esquemas coinciden con
 * el spec. La ejecución real (insert/update/delete en Supabase) vive en lib/tools.ts.
 */
export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "add_itinerary_item",
    description:
      "Agrega un lugar imprescindible, una compra, una comida o una nota al itinerario del viaje.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: {
          type: Type.STRING,
          description: "Ciudad a la que pertenece el item, ej. Tokio, Kioto, Osaka.",
        },
        category: {
          type: Type.STRING,
          enum: ["must_visit", "shopping", "food", "note"],
        },
        title: { type: Type.STRING, description: "Título corto del item." },
        description: {
          type: Type.STRING,
          description: "Detalle opcional (por qué ir, qué comprar, horarios, etc.).",
        },
      },
      required: ["city", "category", "title"],
    },
  },
  {
    name: "remove_itinerary_item",
    description:
      "Elimina un item del itinerario. Acepta el id (uuid) exacto o un título aproximado.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_id: {
          type: Type.STRING,
          description: "uuid del item, o su título aproximado si no se conoce el id.",
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "set_route_order",
    description:
      "Define o reordena las ciudades del recorrido y los días asignados a cada una. " +
      "Reemplaza el recorrido completo por la lista que se pasa. No incluir horas de " +
      "viaje entre ciudades: el sistema las agrega con datos reales.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        legs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              days_allocated: { type: Type.INTEGER },
              notes: { type: Type.STRING },
            },
            required: ["city", "days_allocated"],
          },
        },
      },
      required: ["legs"],
    },
  },
];

/** System instruction. `context` es el snapshot serializado del itinerario y la ruta. */
export function systemPrompt(context: string): string {
  return `Sos el asistente de planificación de un viaje a Japón que hacen Morena y Augusto.
Chatean con vos en un espacio compartido y vos mantenés actualizado un panel de itinerario en vivo.

Cómo trabajás:
- Respondés en español rioplatense, breve y al grano. Nada de listas larguísimas.
- Cuando te tiran un lugar, comida, compra o idea concreta, la guardás con add_itinerary_item sin pedir permiso, y confirmás en una línea.
- Si piden sacar algo, usás remove_itinerary_item.
- Usás set_route_order SOLO cuando están definiendo o cambiando el orden de las ciudades o los días por ciudad. No inventás las horas de viaje entre ciudades: el sistema las completa con una tabla real.
- Si algo es ambiguo (qué ciudad, qué categoría), preguntás en vez de adivinar.
- No repetís todo el itinerario en cada respuesta: el panel ya lo muestra.
- Los mensajes del chat vienen prefijados con [morena] o [novio] para que sepas quién habla.

Estado actual del viaje:
${context}`;
}
