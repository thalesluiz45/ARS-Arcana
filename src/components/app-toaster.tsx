"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "font-sans",
          title: "font-medium",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
