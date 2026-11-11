import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatePanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
  tone?: "default" | "error";
  actions?: ReactNode;
  className?: string;
};

export function StatePanel({
  icon: Icon,
  title,
  description,
  eyebrow,
  tone = "default",
  actions,
  className,
}: StatePanelProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "surface-card flex flex-col items-center px-6 py-14 text-center sm:px-10 sm:py-16",
        tone === "error" && "border-destructive/25 bg-[#fdf4f1]",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full border",
          tone === "error"
            ? "border-destructive/25 bg-destructive/10 text-destructive"
            : "border-gold/35 bg-parchment text-forest",
        )}
      >
        <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      {eyebrow ? <p className="eyebrow mt-6 text-muted-foreground">{eyebrow}</p> : null}
      <h2 className="mt-3 text-2xl text-forest sm:text-[1.8rem]">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {actions ? <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
