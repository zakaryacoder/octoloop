"use client";
// OCTOLOOP V2 — client-side i18n (next-intl core, no URL prefix).
// Locale persisted to localStorage + cookie NEXT_LOCALE. Arabic => dir=rtl.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createTranslator } from "use-intl/core";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import ar from "@/messages/ar.json";
import { setActiveLocale } from "@/lib/enum-labels";

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_STORAGE = "octoloop_locale";

const MESSAGES: Record<Locale, unknown> = { en, fr, ar };

function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  // 1. cookie (set by selector or middleware)
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  if (m) {
    const cookieLocale = decodeURIComponent(m[1]);
    if (isLocale(cookieLocale)) return cookieLocale;
  }
  // 2. localStorage
  const ls = window.localStorage.getItem(LOCALE_STORAGE);
  if (isLocale(ls)) return ls;
  // 3. navigator
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  if (isLocale(nav)) return nav;
  return DEFAULT_LOCALE;
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export type TFunction = (key: string, values?: Record<string, unknown>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  // Read persisted locale once on mount (client-only; avoids SSR mismatch).
  useEffect(() => {
    const l = readInitialLocale();
    setLocaleState(l);
    applyDocumentLocale(l);
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    if (!isLocale(l)) return;
    setLocaleState(l);
    applyDocumentLocale(l);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCALE_STORAGE, l);
    // Persist cookie (1 year) so middleware / SSR can read it later.
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(
      l
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, []);

  const t = useMemo<TFunction>(() => {
    // Keep humanize()/formatDate() helpers on the same language as the UI.
    setActiveLocale(locale);
    const translator = createTranslator({
      locale,
      messages: MESSAGES[locale] as Record<string, unknown>,
      onError: () => {},
      getMessageFallback: ({ key }: { key: string }) => key,
    });
    return (key: string, values?: Record<string, unknown>) => {
      try {
        return translator(key, values as never) as string;
      } catch {
        return key;
      }
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback so components never crash outside provider.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key) => key,
    };
  }
  return ctx;
}

export function useT(): TFunction {
  return useI18n().t;
}
