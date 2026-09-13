import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createOrganization, listMyOrganizations } from "@/server/services/org.service";
import { createOrgSchema } from "@/validations/org.schema";

export const runtime = "nodejs";

export const GET = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  const organizations = await listMyOrganizations(String(session.user._id));
  return ok({ organizations });
});

export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const body = await parseBody(req, createOrgSchema);
  const org = await createOrganization(String(session.user._id), body);
  return ok({ organization: org }, { status: 201 });
});
