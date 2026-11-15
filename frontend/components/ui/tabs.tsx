"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1",
        className
      )}
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
            active === t.id
              ? "bg-white text-navy shadow-sm"
              : "text-ink-muted hover:text-ink-body"
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[11px] tabular",
                active === t.id ? "bg-teal-light text-teal-dark" : "bg-slate-200 text-ink-muted"
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  active,
  id,
  children,
}: {
  active: string;
  id: string;
  children: ReactNode;
}) {
  if (active !== id) return null;
  return <div className="animate-fade-in">{children}</div>;
}
