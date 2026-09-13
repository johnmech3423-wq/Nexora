"use client";

import * as React from "react";

/**
 * Shared "current time" clock for client components.
 *
 * `Date.now()` during render breaks React's purity rules (and SSR/hydration
 * stability), so this exposes the current epoch millis through a single
 * module-level useSyncExternalStore store that ticks once a minute.
 * Server rendering snapshots `0`; the first client tick fires right after
 * hydration, keeping server/client markup consistent.
 */
let snapshot = 0;
let started = false;
const listeners = new Set<() => void>();

function tick() {
  snapshot = Date.now();
  for (const l of [...listeners]) l();
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = Date.now();
  window.setInterval(tick, 60_000);
  queueMicrotask(tick);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  ensureStarted();
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): number {
  return snapshot;
}

/** Current epoch millis, refreshed every ~60s and on window focus. */
export function useNow(): number {
  React.useEffect(() => {
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
