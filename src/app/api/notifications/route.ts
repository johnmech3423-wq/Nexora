import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { connectDb } from "@/server/db/db";
import { Notification } from "@/server/db/models/notification.model";
import { resolveOrgContext } from "@/server/authorization/context";
import { markAllNotificationsRead } from "@/server/services/notification.service";
import { getUserInfos } from "@/server/db/lookups";
import type { NotificationDTO } from "@/types";
import { parsePositiveInt } from "@/lib/utils";
import { toAssignee, emptyPerson } from "@/server/serializers/task";

export const runtime = "nodejs";

/** GET /api/notifications?orgId=&page=&unreadOnly= */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgParam = req.nextUrl.searchParams.get("orgId");
  if (!orgParam) throw new Error("Missing orgId query param");
  const org = await resolveOrgContext(String(session.user._id), orgParam);

  await connectDb();
  const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 20), 50);
  const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";

  const filter: Record<string, unknown> = {
    recipientId: session.user._id,
    organizationId: org.organizationId,
  };
  if (unreadOnly) filter.readAt = null;

  const [docs, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId: session.user._id, organizationId: org.organizationId, readAt: null }),
  ]);
  const actorIds = [...new Set(docs.map((d) => (d.actorId ? String(d.actorId) : "")).filter(Boolean))];
  const users = await getUserInfos(actorIds);
  const items: NotificationDTO[] = docs.map((d) => ({
    id: String(d._id),
    type: d.type,
    title: d.title,
    body: d.body,
    actor: d.actorId ? toAssignee(users.get(String(d.actorId))) ?? emptyPerson(String(d.actorId)) : null,
    link: d.link,
    read: Boolean(d.readAt),
    createdAt: d.createdAt.toISOString(),
  }));
  return ok({ items, total, unread, hasMore: page * pageSize < total });
});

/** POST /api/notifications?orgId= — mark all as read. */
export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgParam = req.nextUrl.searchParams.get("orgId");
  if (!orgParam) throw new Error("Missing orgId query param");
  const org = await resolveOrgContext(String(session.user._id), orgParam);
  await markAllNotificationsRead(String(session.user._id), org.organizationId);
  return ok({ updated: true });
});
