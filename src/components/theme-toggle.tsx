"use client";

import { useTheme } from "next-themes";

/**
 * Hydration-safe theme toggle used by the shell & settings.
 *
 * next-themes resolves the stored theme in an effect after hydration and
 * re-renders consumers, so there is no need for a manual `mounted` flag:
 * the first client render matches the server markup (both fall back to
 * "system"/"light") and the actual theme arrives on the very next render.
 */
export function useThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return {
    mounted: true,
    theme: theme ?? "system",
    resolvedTheme: resolvedTheme ?? "light",
    setTheme,
  };
}
