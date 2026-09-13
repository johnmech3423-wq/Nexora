import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { connectDb } from "@/server/db/db";
import { ActivityLog } from "@/server/db/models/activity-log.model";
import { resolveOrgContext } from "@/server/authorization/context";
import { getUserInfos } from "@/server/db/lookups";
import type { ActivityDTO } from "@/types";
import { parsePositiveInt } from "@/lib/utils";
import { toAssignee, emptyPerson } from "@/server/serializers/task";

export const runtime = "nodejs";

/**
 * GET /api/activity?orgId=&page=&projectId=
 * Org audit feed. Members see it; entries never expose IPs.
 */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgParam = req.nextUrl.searchParams.get("orgId");
  if (!orgParam) throw new Error("Missing orgId query param");
  const org = await resolveOrgContext(String(session.user._id), orgParam);
  await connectDb();

  const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 30), 100);
  const projectId = req.nextUrl.searchParams.get("projectId");
  const filter: Record<string, unknown> = { organizationId: org.organizationId };
  if (projectId) filter.projectId = projectId;

  const [docs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ActivityLog.countDocuments(filter),
  ]);
  const userIds = [...new Set(docs.map((d) => (d.actorId ? String(d.actorId) : "")).filter(Boolean))];
  const users = await getUserInfos(userIds);
  const items: ActivityDTO[] = docs.map((d) => ({
    id: String(d._id),
    action: d.action,
    actor: d.actorId ? toAssignee(users.get(String(d.actorId))) ?? emptyPerson(String(d.actorId)) : null,
    entityType: d.entityType ?? "org",
    entityId: d.entityId ? String(d.entityId) : null,
    metadata: (d.metadata ?? null) as Record<string, unknown> | null,
    createdAt: d.createdAt.toISOString(),
  }));
  return ok({ items, total, hasMore: page * pageSize < total });
});
