"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink-body placeholder:text-ink-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
