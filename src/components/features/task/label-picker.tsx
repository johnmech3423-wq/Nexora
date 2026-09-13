"use client";

import * as React from "react";
import { Check, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LabelOption {
  id: string;
  name: string;
  color: string;
}

/** Multi-select popover for task labels. */
export function LabelPicker({
  options,
  value,
  onValueChange,
  disabled,
  align = "start",
}: {
  options: LabelOption[];
  value: string[]; // label ids
  onValueChange: (ids: string[]) => void;
  disabled?: boolean;
  align?: "start" | "center" | "end";
}) {
  const selected = options.filter((o) => value.includes(o.id));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-8 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-2.5 py-1 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            selected.length === 0 && "text-muted-foreground"
          )}
          aria-label="Select labels"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {selected.length === 0 ? "Labels" : selected.slice(0, 4).map((l) => (
              <span
                key={l.id}
                className="inline-flex max-w-[120px] items-center gap-1 truncate rounded-sm px-1.5 py-px text-[11px] font-medium"
                style={{ background: `${l.color}26`, color: l.color }}
              >
                <Tag className="size-2.5 shrink-0" aria-hidden /> {l.name}
              </span>
            ))}
            {selected.length > 4 ? <span className="text-xs text-muted-foreground">+{selected.length - 4}</span> : null}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Labels</p>
        {options.length === 0 ? (
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            No labels yet — add them in project settings.
          </p>
        ) : (
          <ul role="listbox" aria-label="Labels" aria-multiselectable="true" className="max-h-56 space-y-0.5 overflow-y-auto">
            {options.map((l) => {
              const on = value.includes(l.id);
              return (
                <li key={l.id} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => onValueChange(on ? value.filter((id) => id !== l.id) : [...value, l.id])}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className="flex size-3.5 items-center justify-center rounded-sm border"
                      style={{ borderColor: l.color, background: on ? l.color : "transparent" }}
                    >
                      {on ? <Check className="size-2.5 text-white" /> : null}
                    </span>
                    <span className="truncate">{l.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selected.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full text-xs"
            onClick={() => onValueChange([])}
          >
            Clear labels
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
