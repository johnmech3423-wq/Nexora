"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  leading?: React.ReactNode;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No results found.",
  allowClear,
  className,
  disabled,
  align = "start",
  width = "w-64",
  triggerClassName,
}: {
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  allowClear?: boolean;
  className?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  width?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find((o) => o.value === value);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q))
      : options;
  }, [options, search]);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", triggerClassName)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected?.leading}
              <span className="truncate">{selected ? selected.label : placeholder}</span>
            </span>
            <span className="ml-2 flex items-center gap-1">
              {allowClear && value ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear selection"
                  className="rounded p-0.5 hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    onValueChange(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onValueChange(null);
                    }
                  }}
                >
                  <X className="size-3.5 text-muted-foreground" />
                </span>
              ) : null}
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} className={cn("p-0", width)}>
          <Command shouldFilter={false}>
            <div className="relative flex items-center border-b px-2">
              <Search className="mr-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandList>
              {visible.length === 0 ? <CommandEmpty>{emptyLabel}</CommandEmpty> : null}
              <CommandGroup>
                {visible.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    disabled={o.disabled}
                    onSelect={() => {
                      onValueChange(o.value === value ? (allowClear ? null : o.value) : o.value);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn("size-4", value === o.value ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    {o.leading}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint ? <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
