"use client";
// Patient portal horizontal tab navigation (no staff sidebar).
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { tx } from "@/lib/tx";

interface PortalNavItem {
  href: string;
  tKey: string;
  icon: LucideIcon;
}

const ITEMS: PortalNavItem[] = [
  { href: "/portal", tKey: "portal.overview", icon: Home },
  { href: "/portal/appointments", tKey: "portal.appointments", icon: CalendarDays },
  { href: "/portal/referrals", tKey: "portal.referrals", icon: Send },
  { href: "/portal/follow-ups", tKey: "portal.followUps", icon: ClipboardList },
  { href: "/portal/notifications", tKey: "portal.notifications", icon: Bell },
  { href: "/portal/instructions", tKey: "portal.instructions", icon: FileText },
];

export function PortalNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      aria-label={tx("Portal navigation")}
      className="flex gap-1 overflow-x-auto border-b border-line bg-white px-2"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/portal"
            ? pathname === "/portal"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-3 text-[13px] font-medium transition-colors",
              active ? "text-teal-dark" : "text-ink-muted hover:text-ink-body"
            )}
          >
            <Icon size={15} />
            {t(item.tKey)}
            {active && (
              <span className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-t bg-teal" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
