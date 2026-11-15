"use client";

import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  size = 32,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-navy text-white font-semibold select-none",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}
