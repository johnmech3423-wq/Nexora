"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ConfirmDialog = AlertDialogPrimitive.Root;
export const ConfirmDialogTrigger = AlertDialogPrimitive.Trigger;

export function ConfirmDialogContent({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  className,
  ...props
}: {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm?: () => void;
  className?: string;
} & React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-popover p-5 shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        <AlertDialogPrimitive.Title className="text-base font-semibold">{title}</AlertDialogPrimitive.Title>
        {description ? (
          <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
            {description}
          </AlertDialogPrimitive.Description>
        ) : null}
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: "outline", size: "sm" })}>
            {cancelLabel}
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action
            className={buttonVariants({ variant: destructive ? "destructive" : "default", size: "sm" })}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? (
              <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {confirmLabel}
          </AlertDialogPrimitive.Action>
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

/** Imperative convenience: <ConfirmButton .../> renders a trigger + dialog. */
export function ConfirmButton({
  children,
  onConfirm,
  ...dialogProps
}: {
  children: React.ReactNode;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <ConfirmDialog>
      <ConfirmDialogTrigger asChild>{children}</ConfirmDialogTrigger>
      <ConfirmDialogContent
        title={dialogProps.title}
        description={dialogProps.description}
        confirmLabel={dialogProps.confirmLabel}
        destructive={dialogProps.destructive}
        onConfirm={onConfirm}
      />
    </ConfirmDialog>
  );
}
