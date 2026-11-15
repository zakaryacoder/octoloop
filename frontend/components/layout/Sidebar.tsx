"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { tx } from "@/lib/tx";

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };
  const groups = Array.from(new Set(NAV_ITEMS.map((n) => n.group)));

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={onCloseMobile}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-white font-bold">
            O
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-white">
              {tx("OCTOLOOP")}
            </p>
            <p className="text-[10.5px] uppercase tracking-widest text-white/50">
              {tx("Follow-up Command")}
            </p>
          </div>
        </Link>
        <button
          className="rounded-md p-1.5 text-white/70 hover:bg-white/10 lg:hidden"
          onClick={onCloseMobile}
          aria-label={tx("Close menu")}
        >
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g} className="mt-4 first:mt-1">
            <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-white/40">
              {t(`nav.groups.${(g || "overview").toLowerCase()}`)}
            </p>
            <ul className="space-y-0.5">
              {NAV_ITEMS.filter((n) => n.group === g).map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                        active
                          ? "bg-teal/15 text-white"
                          : "text-white/65 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-teal" />
                      )}
                      <Icon
                        size={17}
                        className={active ? "text-teal" : "text-white/50 group-hover:text-white/80"}
                      />
                      {item.tKey ? t(item.tKey) : item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] text-white/40">
          {tx("OCTOLOOP v2.0 · Frozen API contract")}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-[260px] shrink-0 bg-navy text-white">
        {content}
      </aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-[rgba(15,37,55,0.45)]"
            onClick={onCloseMobile}
          />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-navy text-white shadow-pop animate-fade-in">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
