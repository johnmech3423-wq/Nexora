import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN, PLAN_LIMITS, PLAN_PRICING, PLANS } from "@/lib/constants";

describe("plan and task safety constants", () => {
  it("keeps the three supported plans and default plan", () => {
    expect(PLANS).toEqual(["free", "pro", "business"]);
    expect(DEFAULT_PLAN).toBe("free");
  });

  it("keeps AI daily limits aligned with plan behavior", () => {
    expect(PLAN_LIMITS.free.aiRequestsPerMemberPerDay).toBe(0);
    expect(PLAN_LIMITS.pro.aiRequestsPerMemberPerDay).toBe(30);
    expect(PLAN_LIMITS.business.aiRequestsPerMemberPerDay).toBe(100);
  });

  it("keeps pricing metadata numeric and ordered", () => {
    expect(PLAN_PRICING.free.monthly).toBe(0);
    expect(PLAN_PRICING.pro.monthly).toBe(12);
    expect(PLAN_PRICING.business.monthly).toBe(29);
  });

});
