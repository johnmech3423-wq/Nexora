import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/settings/profile?tab=security", "/settings/profile?tab=security"],
    [" /projects/123 ", "/projects/123"],
  ])("accepts same-site path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "",
    "dashboard",
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example",
    "/%2F%2Fevil.example",
    "/%5C%5Cevil.example",
    "/safe\nLocation: https://evil.example",
    "/safe\rLocation: https://evil.example",
    "/%0aLocation:%20https://evil.example",
    "/%0dLocation:%20https://evil.example",
    "%2F%2Fevil.example",
  ])("rejects unsafe destination %s", (input) => {
    expect(safeNext(input)).toBe("");
  });

  it("does not throw on malformed percent encoding", () => {
    expect(safeNext("/%E0%A4%A")).toBe("");
  });
});
