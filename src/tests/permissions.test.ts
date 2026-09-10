import { describe, expect, it } from "vitest";
import {
  orgRoleHasPermission,
  projectRoleHasPermission,
  orgRolePermissions,
  projectRolePermissions,
} from "@/lib/permissions";

describe("organization permissions", () => {
  it("gives owners every registered permission", () => {
    expect(orgRolePermissions("owner")).toHaveLength(37);
    expect(orgRoleHasPermission("owner", "billing.manage")).toBe(true);
    expect(orgRoleHasPermission("owner", "ai.use")).toBe(true);
  });

  it("keeps billing owner-only", () => {
    expect(orgRoleHasPermission("admin", "billing.manage")).toBe(false);
    expect(orgRoleHasPermission("member", "billing.manage")).toBe(false);
    expect(orgRoleHasPermission("guest", "billing.manage")).toBe(false);
  });

  it("allows members to create but not manage projects", () => {
    expect(orgRoleHasPermission("member", "project.create")).toBe(true);
    expect(orgRoleHasPermission("member", "project.update")).toBe(false);
    expect(orgRoleHasPermission("member", "project.delete")).toBe(false);
    expect(orgRoleHasPermission("member", "project.archive")).toBe(false);
  });

  it("keeps guests read-oriented", () => {
    expect(orgRoleHasPermission("guest", "org.read")).toBe(true);
    expect(orgRoleHasPermission("guest", "project.read")).toBe(true);
    expect(orgRoleHasPermission("guest", "task.read")).toBe(true);
    expect(orgRoleHasPermission("guest", "task.create")).toBe(false);
    expect(orgRoleHasPermission("guest", "ai.use")).toBe(false);
  });
});

describe("project permissions", () => {
  it("gives managers every project permission", () => {
    expect(projectRolePermissions("manager")).toHaveLength(25);
    expect(projectRoleHasPermission("manager", "task.update")).toBe(true);
    expect(projectRoleHasPermission("manager", "sprint.manage")).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(projectRoleHasPermission("viewer", "project.read")).toBe(true);
    expect(projectRoleHasPermission("viewer", "task.read")).toBe(true);
    expect(projectRoleHasPermission("viewer", "task.update")).toBe(false);
    expect(projectRoleHasPermission("viewer", "task.create")).toBe(false);
  });
});
