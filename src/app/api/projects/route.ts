import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createProject, listProjects } from "@/server/services/project.service";
import { createProjectSchema, projectListQuerySchema } from "@/validations/project.schema";
import { parsePositiveInt } from "@/lib/utils";

export const runtime = "nodejs";

/** GET /api/projects?orgId=…&page=&pageSize=&q=&status= */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const parsed = projectListQuerySchema.safeParse({
    page: req.nextUrl.searchParams.get("page"),
    pageSize: req.nextUrl.searchParams.get("pageSize"),
    q: req.nextUrl.searchParams.get("q"),
    status: req.nextUrl.searchParams.get("status"),
    sort: req.nextUrl.searchParams.get("sort"),
  });
  const params = parsed.success ? parsed.data : {};
  const result = await listProjects(String(session.user._id), orgId, {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 12, 50),
    q: params.q,
    includeArchived: params.status === "archived" || params.status === "all",
    sort: params.sort,
  });
  return ok(result);
});

/** POST /api/projects?orgId=… */
export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const body = await parseBody(req, createProjectSchema);
  const project = await createProject(String(session.user._id), orgId, body);
  return ok({ project }, { status: 201 });
});
