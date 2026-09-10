import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { unreadNotificationCount } from "@/server/services/notification.service";
import { resolveOrgContext } from "@/server/authorization/context";

export const runtime = "nodejs";

export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgParam = req.nextUrl.searchParams.get("orgId");
  if (!orgParam) return ok({ count: 0 });
  const org = await resolveOrgContext(String(session.user._id), orgParam);
  const count = await unreadNotificationCount(String(session.user._id), org.organizationId);
  return ok({ count });
});
