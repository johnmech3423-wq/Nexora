"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border bg-popover text-popover-foreground shadow-lg !border-border !font-sans",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
