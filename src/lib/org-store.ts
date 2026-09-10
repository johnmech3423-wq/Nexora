"use client";

import { create } from "zustand";

export interface OrgOption {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  myRole: string;
  plan: string;
  memberCount: number;
}

interface OrgState {
  /** Server-verified list of orgs the signed-in user belongs to. */
  options: OrgOption[];
  setOptions: (orgs: OrgOption[]) => void;
  /** Active tenant id (persisted per browser). */
  activeOrgId: string | null;
  setActiveOrgId: (id: string | null) => void;
  /** Metadata refresh trigger after org mutations. */
  bump: number;
  bumpOrg: () => void;
}

const STORAGE_KEY = "nexora.activeOrgId";

export const useOrgStore = create<OrgState>((set) => ({
  options: [],
  setOptions: (options) => set({ options }),
  activeOrgId: null,
  setActiveOrgId: (id) => {
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
    set({ activeOrgId: id });
  },
  bump: 0,
  bumpOrg: () => set((s) => ({ bump: s.bump + 1 })),
}));

/** Restore persisted tenant on first client load (call once in a provider). */
export function restoreActiveOrg(options: OrgOption[]): string | null {
  const { activeOrgId, setOptions, setActiveOrgId } = useOrgStore.getState();
  if (options.length && !activeOrgId) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const valid = options.some((o) => o.id === stored) ? stored : options[0]?.id ?? null;
    setOptions(options);
    if (valid) setActiveOrgId(valid);
    return valid;
  }
  return activeOrgId && options.some((o) => o.id === activeOrgId) ? activeOrgId : options[0]?.id ?? null;
}
