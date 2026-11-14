import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingPanel({
  label,
  description,
  className,
}: {
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "surface-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <Loader2 className="size-7 animate-spin text-forest" aria-hidden="true" />
      <p className="text-sm font-medium text-forest">{label}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
