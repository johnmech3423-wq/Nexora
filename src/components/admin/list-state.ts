"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parsePositiveInt } from "@/lib/utils";
import { ADMIN_PAGE_SIZE_MAX } from "@/lib/admin-api";

export const ADMIN_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function useAdminListState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const page = parsePositiveInt(sp.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(sp.get("pageSize"), ADMIN_DEFAULT_PAGE_SIZE), ADMIN_PAGE_SIZE_MAX);

  /** Draft search text (debounced commit to the URL). */
  const [draft, setDraft] = React.useState(q);
  const committedRef = React.useRef(q);

  React.useEffect(() => {
    committedRef.current = q;
  }, [q]);

  const commit = React.useCallback(
    (patch: { q?: string; page?: number; pageSize?: number; resetPage?: boolean }) => {
      const next = new URLSearchParams();
      const clean = (patch.q ?? committedRef.current ?? "").trim();
      if (clean) next.set("q", clean);
      const ps = patch.pageSize ?? pageSize;
      const pg = patch.resetPage ? 1 : (patch.page ?? page);
      if (ps !== ADMIN_DEFAULT_PAGE_SIZE) next.set("pageSize", String(ps));
      if (pg > 1) next.set("page", String(pg));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, pageSize, page]
  );

  // Debounced search commit (typing → URL, resets to page 1).
  React.useEffect(() => {
    if (draft === committedRef.current) return;
    const t = setTimeout(() => commit({ q: draft, resetPage: true }), 400);
    return () => clearTimeout(t);
  }, [draft, commit]);

  const setPage = React.useCallback(
    (nextPage: number) => commit({ page: nextPage }),
    [commit]
  );
  const setPageSize = React.useCallback(
    (nextSize: number) => commit({ pageSize: nextSize, resetPage: true }),
    [commit]
  );

  return { q, draft, setDraft, page, setPage, pageSize, setPageSize };
}

/** Keys for React Query cache + invalidation. */
export function adminListQueryKey(kind: "users" | "organizations", opts: { q?: string; page?: number; pageSize?: number }) {
  return ["admin", "list", kind, { q: opts.q ?? "", page: opts.page ?? 1, pageSize: opts.pageSize ?? ADMIN_DEFAULT_PAGE_SIZE }] as const;
}
