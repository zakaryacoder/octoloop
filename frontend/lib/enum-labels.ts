// Shared, locale-aware labels for backend enum values (statuses, priorities, roles...).
// The I18nProvider calls setActiveLocale() on every locale change, so helpers such as
// humanize() and formatDate() always follow the language selected by the user.
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import ar from "@/messages/ar.json";

export type ActiveLocale = "en" | "fr" | "ar";

const ENUMS: Record<ActiveLocale, Record<string, string>> = {
  en: (en as { enums: Record<string, string> }).enums,
  fr: (fr as { enums: Record<string, string> }).enums,
  ar: (ar as { enums: Record<string, string> }).enums,
};

// Intl tags. Arabic uses Latin digits (nu-latn), the usual convention in Morocco.
const INTL_TAGS: Record<ActiveLocale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  ar: "ar-MA-u-nu-latn",
};

let active: ActiveLocale = "en";

export function setActiveLocale(l: ActiveLocale): void {
  active = l;
}

export function getActiveLocale(): ActiveLocale {
  return active;
}

export function getIntlTag(): string {
  return INTL_TAGS[active];
}

/** Translated label for an enum value, or null when no translation exists. */
export function enumLabel(value: string): string | null {
  const v = ENUMS[active]?.[value];
  return typeof v === "string" ? v : null;
}
