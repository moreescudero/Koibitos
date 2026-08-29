"use client";

import { useEffect, useRef, useState } from "react";
import type { Message, Sender } from "@/lib/types";

interface Props {
  messages: Message[];
  me: Sender;
  waiting: boolean;
  onSend: (text: string) => void;
}

const NAME: Record<Sender, string> = {
  morena: "Morena",
  novio: "Novio",
  claude: "Claude",
};

export function ChatPanel({ messages, me, waiting, onSend }: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waiting]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold dark:border-neutral-800">
        Chat
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            Tirá los primeros datos del viaje y el itinerario se arma solo.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender === me;
          const isClaude = m.sender === "claude";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
            >
              <span className="px-1 text-[11px] text-neutral-400">
                {NAME[m.sender]}
              </span>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  isClaude
                    ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                    : mine
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                } ${m.id.startsWith("temp-") ? "opacity-60" : ""}`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        {waiting && (
          <div className="flex items-start">
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">
              Claude está pensando…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribí algo del viaje…"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
