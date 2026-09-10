import { describe, expect, it } from "vitest";
import { clamp, formatBytes, formatDuration, initials, parsePositiveInt, truncate } from "@/lib/utils";
import { qs } from "@/lib/api-client";

describe("utility helpers", () => {
  it("builds query strings while dropping empty values", () => {
    expect(qs({ page: 2, q: "hello world", empty: "", missing: undefined, tags: ["a", "", "b"] })).toBe("?page=2&q=hello+world&tags=a&tags=b");
    expect(qs({})).toBe("");
  });

  it("clamps values to a range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("parses positive integers with fallback and max", () => {
    expect(parsePositiveInt("12", 5)).toBe(12);
    expect(parsePositiveInt("0", 5)).toBe(5);
    expect(parsePositiveInt("bad", 5)).toBe(5);
    expect(parsePositiveInt("999", 5, 100)).toBe(100);
  });

  it("formats common display values", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(90 * 60 * 1000)).toBe("1h 30m");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(0)).toBe("0 B");
    expect(initials("Ava Reyes")).toBe("AR");
    expect(initials("avery")).toBe("AV");
    expect(initials("  ")).toBe("?");
    expect(truncate("abcdefghij", 6)).toBe("abcde…");
  });
});
