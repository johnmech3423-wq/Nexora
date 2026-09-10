import type { ProjectMemberDTO, ProjectStatusDTO } from "@/types";
import type { ProjectStatusSetting } from "@/server/db/models/project.model";
import type { ProjectRole } from "@/lib/permissions";
import type { OrgRole } from "@/lib/constants";
import type { UserInfo } from "@/server/db/lookups";

export function serializeStatusSetting(s: ProjectStatusSetting): ProjectStatusDTO {
  return { key: s.key, label: s.label, color: s.color, index: s.index };
}

export function serializeProjectMember(
  pm: { _id: unknown; userId: unknown; role: ProjectRole; createdAt: Date },
  user: UserInfo,
  orgRole: OrgRole,
  taskCount: number
): ProjectMemberDTO {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: pm.role,
    orgRole,
    taskCount,
    addedAt: pm.createdAt.toISOString(),
  };
}
