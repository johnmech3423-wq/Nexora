"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  // Window of page numbers around the current page.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  const nums: (number | "…")[] = [];
  if (start > 1) nums.push(1);
  if (start > 2) nums.push("…");
  for (let i = start; i <= end; i++) nums.push(i);
  if (end < pages - 1) nums.push("…");
  if (end < pages) nums.push(pages);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-2 text-sm", className)}
    >
      <p className="text-xs text-muted-foreground">
        {total === 0 ? "0 results" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <ul className="flex items-center gap-0.5">
          {nums.map((n, i) =>
            n === "…" ? (
              <li key={`e${i}`} className="px-1 text-muted-foreground">
                …
              </li>
            ) : (
              <li key={n}>
                <Button
                  variant={n === page ? "secondary" : "ghost"}
                  size="icon-sm"
                  className="text-xs"
                  aria-current={n === page ? "page" : undefined}
                  onClick={() => onPageChange(n)}
                >
                  {n}
                </Button>
              </li>
            )
          )}
        </ul>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
