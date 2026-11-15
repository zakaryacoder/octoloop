"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, LogOut, Menu, Search, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { humanize } from "@/lib/constants";
import type { NotificationItem } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { useI18n } from "@/lib/i18n";
import { tx } from "@/lib/tx";

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [unread, setUnread] = useState<number>(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<NotificationItem[]>("/notifications/staff/unread")
      .then((list) => {
        if (!cancelled) setUnread(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => {
        if (!cancelled) setUnread(0);
      });
    const t = setInterval(() => {
      api
        .get<NotificationItem[]>("/notifications/staff/unread")
        .then((list) => {
          if (!cancelled) setUnread(Array.isArray(list) ? list.length : 0);
        })
        .catch(() => {});
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/patients?search=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6">
      <button
        className="rounded-lg p-2 text-ink-body hover:bg-slate-100 lg:hidden"
        onClick={onOpenMobile}
        aria-label={tx("Open menu")}
      >
        <Menu size={20} />
      </button>

      <form onSubmit={onSearch} className="relative hidden sm:block w-full max-w-sm">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tx("Search patients by name or MRN…")}
          className="pl-9 bg-slate-50/80 border-transparent focus:bg-white"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <LanguageSelector />
        <button
          onClick={() => router.push("/notifications")}
          className="relative rounded-lg p-2 text-ink-body hover:bg-slate-100 transition-colors"
          aria-label={tx("Notifications")}
        >
          <Bell size={19} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white tabular">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        <Dropdown
          trigger={
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors">
              <Avatar name={user?.full_name || user?.username} size={32} />
              <div className="hidden text-left md:block">
                <p className="text-[13px] font-semibold leading-tight text-ink-heading">
                  {user?.full_name || user?.username || "User"}
                </p>
                <p className="text-[11px] leading-tight text-ink-muted capitalize">
                  {user?.role ? humanize(user.role) : ""}
                </p>
              </div>
            </button>
          }
        >
          <div className="border-b border-line px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-ink-heading">
              {user?.full_name || user?.username}
            </p>
            <p className="text-[11.5px] text-ink-muted">@{user?.username}</p>
          </div>
          <DropdownItem onClick={() => router.push("/admin")}>
            <UserRound size={14} /> {t("auth.accountSettings")}
          </DropdownItem>
          <DropdownItem danger onClick={() => void logout()}>
            <LogOut size={14} /> {t("auth.signOut")}
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
