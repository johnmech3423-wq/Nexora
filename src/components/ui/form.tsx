"use client";

import * as React from "react";
import { createContext, useContext, useId } from "react";
import { Controller, FormProvider, useFormContext, type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";

export { FormProvider };
export { useFormContext as useFormCtx };

const FormItemContext = createContext<{ id: string } | null>(null);
const useFormItem = () => {
  const ctx = useContext(FormItemContext);
  if (!ctx) throw new Error("FormItem must be used inside FormField");
  return ctx;
};

/** RHF Controller + Item + Label + Message wiring (shadcn-style). */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return <Controller {...props} />;
}

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { id } = useFormItem();
  return (
    <label htmlFor={props.htmlFor ?? id} className={cn("block text-[13px] font-medium", className)} {...props} />
  );
}

export function FormControl({ children }: { children: React.ReactElement }) {
  const { id } = useFormItem();
  return (
    <div className="w-full">
      {React.cloneElement(children, { id } as Record<string, unknown>)}
    </div>
  );
}

export function FormDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

/** Helper: small non-field hint under a control. */
export function FormHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>{children}</p>;
}

/** Render the validation error message of a named field (place inside FormItem). */
export function FieldError({ name, className }: { name: string; className?: string }) {
  const { getFieldState, formState } = useFormContext();
  const error = getFieldState(name, formState).error;
  if (!error?.message) return null;
  return <p className={cn("text-xs font-medium text-destructive", className)} role="alert">{error.message}</p>;
}

/** Helper to surface server fieldErrors from ApiClientError into RHF errors. */
export function applyServerErrors(
  fieldErrors: Record<string, string[]> | undefined,
  setError: (name: string, err: { message: string }) => void,
  field: string
): void {
  if (!fieldErrors) return;
  const messages = fieldErrors[field];
  if (messages?.length) setError(field, { message: messages[0] });
}
