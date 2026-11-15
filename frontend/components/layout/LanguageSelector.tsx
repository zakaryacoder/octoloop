"use client";
// Language selector (Phase 8) — EN / FR / AR. Persists to localStorage + cookie.
import { Check, Languages } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          aria-label={t("lang.label")}
          title={t("lang.label")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink-body hover:bg-slate-50 transition-colors"
        >
          <Languages size={15} className="text-teal-dark" />
          {!compact && (
            <span className="uppercase tracking-wide">{locale}</span>
          )}
        </button>
      }
    >
      <div className="border-b border-line px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {t("lang.label")}
      </div>
      {LOCALES.map((l) => (
        <DropdownItem key={l} onClick={() => setLocale(l)}>
          <span className={cn("flex-1", l === "ar" && "font-arabic")}>
            {LABELS[l]}
          </span>
          {locale === l && <Check size={14} className="text-teal-dark" />}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
