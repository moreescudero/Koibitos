// Tipos compartidos entre server, API routes y componentes.

export type Sender = "morena" | "novio" | "claude";

export type Category = "must_visit" | "shopping" | "food" | "note";

export const CATEGORY_LABEL: Record<Category, string> = {
  must_visit: "Imprescindible",
  shopping: "Compras",
  food: "Comida",
  note: "Nota",
};

export interface Trip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  trip_id: string;
  sender: Sender;
  content: string;
  created_at: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  city: string;
  category: Category;
  title: string;
  description: string | null;
  day_index: number | null;
  created_at: string;
}

export interface RouteLeg {
  id: string;
  trip_id: string;
  order_index: number;
  city: string;
  days_allocated: number | null;
  notes: string | null;
}
