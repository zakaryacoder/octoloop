import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Gauge,
  Globe2,
  TrendingUp,
  LayoutDashboard,
  Settings,
  Send,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  /** i18n key used by Sidebar to translate the label (falls back to `label`). */
  tKey?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Command Center", icon: LayoutDashboard, group: "Overview", tKey: "nav.commandCenter" },
  { href: "/patients", label: "Patients", icon: Users, group: "Registry", tKey: "nav.patients" },
  { href: "/screenings", label: "Screenings", icon: Stethoscope, group: "Registry", tKey: "nav.screenings" },
  { href: "/cases", label: "Follow-up Cases", icon: ClipboardList, group: "Workflow", tKey: "nav.cases" },
  { href: "/referrals", label: "Referrals", icon: Send, group: "Workflow", tKey: "nav.referrals" },
  { href: "/appointments", label: "Appointments", icon: CalendarDays, group: "Workflow", tKey: "nav.appointments" },
  { href: "/notifications", label: "Notifications", icon: Bell, group: "Engagement", tKey: "nav.notifications" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "Insight", tKey: "nav.analytics" },
  { href: "/impact", label: "Impact", icon: TrendingUp, group: "Insight", tKey: "nav.impact" },
  { href: "/population", label: "Population Health", icon: Globe2, group: "Insight", tKey: "nav.population" },
  { href: "/admin", label: "Administration", icon: Settings, group: "Insight", tKey: "nav.admin" },
];

export const QUICK_STATS_ICONS: Record<string, LucideIcon> = {
  patients: Users,
  screenings: Activity,
  cases: Gauge,
};
