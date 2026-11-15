// tx("English text") — translates user-visible phrases to the active language (FR / AR).
// English text is the source of truth and the fallback, so a missing entry never breaks the UI.
// Dictionaries: messages/phrases.fr.json and messages/phrases.ar.json (checked by `npm run check:i18n`).
import fr from "@/messages/phrases.fr.json";
import ar from "@/messages/phrases.ar.json";
import { getActiveLocale } from "./enum-labels";

const DICT: Record<"fr" | "ar", Record<string, string>> = {
  fr: fr as Record<string, string>,
  ar: ar as Record<string, string>,
};

export function tx(s: string | null | undefined): string {
  if (!s) return "";
  const loc = getActiveLocale();
  if (loc === "en") return s;
  const d = DICT[loc];
  const hit = d[s];
  if (hit !== undefined) return hit;
  const trimmed = s.trim();
  if (trimmed !== s && d[trimmed] !== undefined) return s.replace(trimmed, d[trimmed]);
  return s;
}
