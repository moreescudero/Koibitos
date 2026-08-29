"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { senderForEmail } from "@/lib/allowed";
import type { ItineraryItem, Message, RouteLeg } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import { ItineraryPanel } from "./ItineraryPanel";

interface Props {
  tripId: string;
  tripName: string;
  userEmail: string;
  initialMessages: Message[];
  initialItems: ItineraryItem[];
  initialLegs: RouteLeg[];
}

type Tab = "chat" | "itinerario";

export function TripView({
  tripId,
  tripName,
  userEmail,
  initialMessages,
  initialItems,
  initialLegs,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const me = senderForEmail(userEmail);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [items, setItems] = useState<ItineraryItem[]>(initialItems);
  const [legs, setLegs] = useState<RouteLeg[]>(initialLegs);
  const [tab, setTab] = useState<Tab>("chat");
  const [waiting, setWaiting] = useState(false);

  // Ids ya conocidos, para deduplicar entre optimistic + realtime + refetch.
  const seenMsgIds = useRef<Set<string>>(
    new Set(initialMessages.map((m) => m.id)),
  );

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Message;
            if (seenMsgIds.current.has(row.id)) return;
            seenMsgIds.current.add(row.id);
            setMessages((prev) => {
              // Reemplazar el optimista equivalente si existe.
              const withoutTemp = prev.filter(
                (m) =>
                  !(
                    m.id.startsWith("temp-") &&
                    m.sender === row.sender &&
                    m.content === row.content
                  ),
              );
              return [...withoutTemp, row].sort(
                (a, b) => a.created_at.localeCompare(b.created_at),
              );
            });
            if (row.sender === "gemini") setWaiting(false);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary_items", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          setItems((prev) => applyChange(prev, payload, "created_at"));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "route_legs", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          setLegs((prev) => applyChange(prev, payload, "order_index"));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tripId]);

  // --- Enviar mensaje ---
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const temp: Message = {
        id: `temp-${Date.now()}`,
        trip_id: tripId,
        sender: me,
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, temp]);
      setWaiting(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, message: trimmed }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "error" }));
          throw new Error(error ?? "error");
        }
      } catch (e) {
        setWaiting(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-err-${Date.now()}`,
            trip_id: tripId,
            sender: "gemini",
            content: `No pude enviar el mensaje (${(e as Error).message}).`,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    },
    [tripId, me],
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <h1 className="text-sm font-semibold">{tripName}</h1>
          <p className="text-xs text-neutral-500">Sos {me}</p>
        </div>
        <nav className="flex gap-1 md:hidden">
          {(["chat", "itinerario"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                tab === t
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-500"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 p-4">
        <section
          className={`min-w-0 flex-1 md:block ${tab === "chat" ? "block" : "hidden"}`}
        >
          <ChatPanel
            messages={messages}
            me={me}
            waiting={waiting}
            onSend={sendMessage}
          />
        </section>
        <section
          className={`min-w-0 flex-1 md:block ${tab === "itinerario" ? "block" : "hidden"}`}
        >
          <ItineraryPanel items={items} legs={legs} />
        </section>
      </div>
    </div>
  );
}

// Aplica un INSERT/UPDATE/DELETE de Realtime a una lista en memoria.
function applyChange<T extends { id: string }>(
  prev: T[],
  payload: { eventType: string; new: unknown; old: unknown },
  sortKey: keyof T,
): T[] {
  if (payload.eventType === "DELETE") {
    const old = payload.old as T;
    return prev.filter((r) => r.id !== old.id);
  }
  const row = payload.new as T;
  const next = prev.filter((r) => r.id !== row.id);
  next.push(row);
  next.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv));
  });
  return next;
}
