import type { Sender } from "./types";

/** Lista de mails permitidos, sacada de NEXT_PUBLIC_ALLOWED_EMAILS. */
export function allowedEmails(): string[] {
  return (process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.toLowerCase());
}

/**
 * Deriva el remitente a partir del mail logueado. El primer mail de la lista es
 * 'morena', el segundo 'novio'. Si no matchea, cae a 'morena'.
 */
export function senderForEmail(email: string | null | undefined): Extract<Sender, "morena" | "novio"> {
  const list = allowedEmails();
  if (email && list[1] && email.toLowerCase() === list[1]) return "novio";
  return "morena";
}
