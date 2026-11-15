"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "navy",
  hint,
  delta,
  deltaTone,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "navy" | "teal" | "amber" | "red" | "blue" | "violet";
  hint?: string;
  delta?: string;
  deltaTone?: "up" | "down";
}) {
  const tones: Record<string, string> = {
    navy: "bg-navy/10 text-navy",
    teal: "bg-teal-light text-teal-dark",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-600",
    blue: "bg-blue-100 text-blue-600",
    violet: "bg-violet-100 text-violet-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-ink-muted">
            {label}
          </p>
          <p className="mt-1.5 text-[28px] font-semibold leading-none text-navy tabular">
            {value}
          </p>
          {(hint || delta) && (
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              {delta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    deltaTone === "down" ? "text-red-600" : "text-teal-dark"
                  )}
                >
                  {deltaTone === "down" ? (
                    <ArrowDownRight size={13} />
                  ) : (
                    <ArrowUpRight size={13} />
                  )}
                  {delta}
                </span>
              )}
              {hint && <span className="text-ink-muted">{hint}</span>}
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            tones[tone]
          )}
        >
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}
