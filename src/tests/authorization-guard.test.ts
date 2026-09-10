import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/server/errors";

const resolveOrgContext = vi.fn();
const resolveProjectAccess = vi.fn();

vi.mock("@/server/authorization/context", () => ({
  resolveOrgContext,
  resolveProjectAccess,
}));

import { assertOrgPermission, assertProjectPermission, requireMemberStatusActive } from "@/server/authorization/guard";

describe("authorization guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires membership before granting an organization permission", async () => {
    resolveOrgContext.mockResolvedValue({ organizationId: "org-1", role: "member" });
    await expect(assertOrgPermission("user-1", "org-1", "project.create")).resolves.toEqual({ organizationId: "org-1" });

    resolveOrgContext.mockResolvedValue({ organizationId: "org-1", role: "guest" });
    await expect(assertOrgPermission("user-1", "org-1", "project.create")).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("does not allow members to use owner-only billing permission", async () => {
    resolveOrgContext.mockResolvedValue({ organizationId: "org-1", role: "admin" });
    await expect(assertOrgPermission("admin-1", "org-1", "billing.manage")).rejects.toMatchObject({ status: 403 });

    resolveOrgContext.mockResolvedValue({ organizationId: "org-1", role: "owner" });
    await expect(assertOrgPermission("owner-1", "org-1", "billing.manage")).resolves.toEqual({ organizationId: "org-1" });
  });

  it("allows org admins across projects but still rejects suspended membership", async () => {
    resolveProjectAccess.mockResolvedValue({
      access: {
        organizationId: "org-1",
        orgRole: "admin",
        project: { _id: "project-1", organizationId: "org-1", settings: { private: true }, archivedAt: null },
        projectRole: null,
        orgRoleLabel: "admin",
      },
      membershipActive: true,
    });
    await expect(assertProjectPermission("admin-1", "project-1", "task.update")).resolves.toMatchObject({ organizationId: "org-1", projectId: "project-1" });

    resolveProjectAccess.mockResolvedValue({
      access: {
        organizationId: "org-1",
        orgRole: "member",
        project: { _id: "project-1", organizationId: "org-1", settings: { private: false }, archivedAt: null },
        projectRole: null,
        orgRoleLabel: "member",
      },
      membershipActive: false,
    });
    await expect(assertProjectPermission("member-1", "project-1", "project.read")).rejects.toMatchObject({ status: 403 });
  });

  it("does not let a project viewer mutate tasks", async () => {
    resolveProjectAccess.mockResolvedValue({
      access: {
        organizationId: "org-1",
        orgRole: "member",
        project: { _id: "project-1", organizationId: "org-1", settings: { private: true }, archivedAt: null },
        projectRole: "viewer",
        orgRoleLabel: "member",
      },
      membershipActive: true,
    });
    await expect(assertProjectPermission("viewer-1", "project-1", "task.update")).rejects.toMatchObject({ status: 403 });
    await expect(assertProjectPermission("viewer-1", "project-1", "task.read")).resolves.toMatchObject({ projectId: "project-1" });
  });

  it("blocks writes to archived projects for the guarded mutation permissions", async () => {
    resolveProjectAccess.mockResolvedValue({
      access: {
        organizationId: "org-1",
        orgRole: "admin",
        project: { _id: "project-1", organizationId: "org-1", settings: { private: false }, archivedAt: new Date() },
        projectRole: null,
        orgRoleLabel: "admin",
      },
      membershipActive: true,
    });
    await expect(assertProjectPermission("admin-1", "project-1", "task.update")).rejects.toMatchObject({ status: 409, code: "conflict" });
    await expect(assertProjectPermission("admin-1", "project-1", "project.update")).rejects.toMatchObject({ status: 409, code: "conflict" });
    await expect(assertProjectPermission("admin-1", "project-1", "task.read")).resolves.toMatchObject({ archived: true });
  });

  it("rejects suspended membership status directly", () => {
    expect(() => requireMemberStatusActive("active")).not.toThrow();
    expect(() => requireMemberStatusActive("suspended")).toThrowError(ApiError);
  });
});
