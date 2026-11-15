"use client";
// Patient portal layout (Phase 9) — minimal, NO staff sidebar.
// Strict own-data: all child pages fetch via /portal/* endpoints only.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { PortalNav } from "@/components/layout/PortalNav";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/constants";
import { tx } from "@/lib/tx";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-appbg">
        <div className="flex flex-col items-center gap-3 text-ink-muted">
          <Loader2 size={28} className="animate-spin text-teal" />
          <p className="text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }

  // Portal is patient-only. Staff users get a friendly access-denied screen.
  if (user.role !== "patient") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-appbg p-6">
        <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-lg font-bold text-ink-heading">{t("portal.title")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("portal.accessDenied")}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {user.full_name || user.username} · {humanize(user.role)}
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button>{t("portal.staffLink")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-appbg">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <Link href="/portal" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-white font-bold">
              O
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight text-navy">{tx("OCTOLOOP")}</p>
              <p className="text-[10.5px] uppercase tracking-widest text-ink-muted">
                {t("portal.title")}
              </p>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelector />
            <Dropdown
              trigger={
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors">
                  <Avatar name={user.full_name || user.username} size={32} />
                  <div className="hidden text-left md:block">
                    <p className="text-[13px] font-semibold leading-tight text-ink-heading">
                      {user.full_name || user.username}
                    </p>
                    <p className="text-[11px] leading-tight text-ink-muted capitalize">
                      {humanize(user.role)}
                    </p>
                  </div>
                </button>
              }
            >
              <div className="border-b border-line px-3.5 py-2.5">
                <p className="text-[13px] font-semibold text-ink-heading">
                  {user.full_name || user.username}
                </p>
                <p className="text-[11.5px] text-ink-muted">@{user.username}</p>
              </div>
              <DropdownItem danger onClick={() => void logout()}>
                <LogOut size={14} /> {t("portal.logout")}
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
        <PortalNav />
      </header>
      <main className="flex-1 p-4 lg:p-6">
        <div className="mx-auto max-w-5xl animate-fade-in">{children}</div>
      </main>
      <footer className="border-t border-line bg-white px-6 py-3 text-center text-[11px] text-ink-muted">
        {tx("OCTOLOOP v2.0 ·")} {t("common.aggregatedAnonymized")}
      </footer>
    </div>
  );
}
