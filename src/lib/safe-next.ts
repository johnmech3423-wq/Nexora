/**
 * Open-redirect-safe destination resolution.
 * Only same-site paths are accepted; anything else resolves to "" (caller decides).
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return "";
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return "";
  if (trimmed.includes("\n") || trimmed.includes("\r")) return "";
  try {
    // Reject encoded protocol tricks like "/%5c%5cevil.com" or "/\evil.com"
    const decoded = decodeURIComponent(trimmed);
    if (/^\/\//.test(decoded) || /^\/\\/.test(decoded)) return "";
    if (decoded.includes("\n") || decoded.includes("\r")) return "";
  } catch {
    return "";
  }
  return trimmed;
}
