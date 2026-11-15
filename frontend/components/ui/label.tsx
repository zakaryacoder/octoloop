"use client";

import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[13px] font-semibold text-ink-heading mb-1.5",
        className
      )}
      {...props}
    />
  );
}
