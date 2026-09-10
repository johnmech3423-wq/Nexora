/* ------------------------------------------------------------------ */
/* AI Tools — safe, permission-checked mutations for the assistant.   */
/* Every tool verifies org membership and project permissions via      */
/* existing guards. Never trusts client-supplied IDs blindly.         */
/* ------------------------------------------------------------------ */
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { Project } from "@/server/db/models/project.model";
import { Task } from "@/server/db/models/task.model";
import { createTask, updateTask, taskDepth, TASK_MAX_DEPTH } from "@/server/services/task.service";
import { assertProjectPermission } from "@/server/authorization/guard";

/** Tool definitions — Zod schemas for validation. */
export const AiToolSchemas = {
  create_task: z.object({
    projectId: z.string().min(1).max(100),
    title: z.string().trim().min(2).max(300),
    description: z.string().trim().max(4000).optional(),
    status: z.enum(["backlog", "todo", "in_progress", "in_review", "done"]).optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
    assigneeId: z.string().optional(),
    dueDate: z.string().optional(), // ISO date string
    parentId: z.string().optional(),
  }),
  create_subtasks: z.object({
    projectId: z.string().min(1).max(100),
    parentTaskId: z.string().min(1).max(100),
    subtasks: z
      .array(
        z.object({
          title: z.string().trim().min(2).max(300),
          description: z.string().trim().max(2000).optional(),
          priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
          assigneeId: z.string().optional(),
          dueDate: z.string().optional(),
        })
      )
      .min(1)
      .max(10),
  }),
  update_task: z.object({
    projectId: z.string().min(1).max(100),
    taskId: z.string().min(1).max(100),
    title: z.string().trim().min(2).max(300).optional(),
    description: z.string().trim().max(4000).optional(),
    status: z.enum(["backlog", "todo", "in_progress", "in_review", "done"]).optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
  }),
} as const;

export type AiToolName = keyof typeof AiToolSchemas;

export interface AiToolCall {
  tool: AiToolName;
  args: unknown;
}

export interface AiToolResult {
  tool: AiToolName;
  ok: boolean;
  message: string;
  data?: unknown;
  errorCode?: string;
}

/** Parse potential tool calls from LLM response — looks for JSON blocks. */
export function parseToolCalls(text: string): AiToolCall[] {
  const calls: AiToolCall[] = [];
  // Look for ```json blocks containing tool calls
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      // Support both single tool call and array
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (item && typeof item.tool === "string" && item.args) {
          if (item.tool in AiToolSchemas) {
            calls.push({ tool: item.tool as AiToolName, args: item.args });
          }
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  // Also look for inline JSON with "tool" key (fallback)
  if (calls.length === 0) {
    const inlineRegex = /\{\s*"tool"\s*:\s*"(create_task|create_subtasks|update_task)"\s*,\s*"args"\s*:\s*\{[\s\S]*?\}\s*\}/g;
    while ((match = inlineRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.tool in AiToolSchemas) {
          calls.push({ tool: parsed.tool as AiToolName, args: parsed.args });
        }
      } catch {
        // ignore
      }
    }
  }

  return calls.slice(0, 5); // max 5 tool calls per response to keep bounded
}

/** Validate a tool call without mutating — used for proposal phase. */
export async function validateProposal(
  actorUserId: string,
  organizationId: string,
  call: AiToolCall
): Promise<{ ok: boolean; message: string; normalizedArgs?: Record<string, unknown>; projectKey?: string; errorCode?: string }> {
  await connectDb();
  const schema = AiToolSchemas[call.tool];
  const parsed = schema.safeParse(call.args);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Invalid arguments for ${call.tool}: ${Object.values(parsed.error.flatten().fieldErrors).flat().join(", ")}`,
      errorCode: "validation_error",
    };
  }

  try {
    if (call.tool === "create_task") {
      const args = parsed.data as z.infer<typeof AiToolSchemas.create_task>;
      const project = await Project.findById(args.projectId).select("organizationId key").lean();
      if (!project) return { ok: false, message: "Project not found.", errorCode: "not_found" };
      if (String(project.organizationId) !== organizationId) return { ok: false, message: "Project not in this workspace.", errorCode: "forbidden" };
      await assertProjectPermission(actorUserId, args.projectId, "task.create");
      if (args.dueDate) {
        const d = new Date(args.dueDate);
        if (isNaN(d.getTime())) return { ok: false, message: "Invalid dueDate.", errorCode: "validation_error" };
      }
      if (args.parentId) {
        const parent = await Task.findById(args.parentId).select("projectId organizationId parentId").lean() as unknown as { projectId: unknown; organizationId: unknown; parentId?: unknown } | null;
        if (!parent) return { ok: false, message: "Parent task not found.", errorCode: "not_found" };
        if (String(parent.projectId) !== args.projectId) return { ok: false, message: "Parent task not in this project.", errorCode: "validation_error" };
        if (String(parent.organizationId) !== organizationId) return { ok: false, message: "Parent task not in this workspace.", errorCode: "forbidden" };
        // Reuse canonical depth logic: parent depth must be < MAX to allow child
        const parentDoc = await Task.findById(args.parentId).where("deletedAt").equals(null);
        if (!parentDoc) return { ok: false, message: "Parent task not found.", errorCode: "not_found" };
        const depth = await taskDepth(parentDoc as unknown as Parameters<typeof taskDepth>[0]);
        if (depth >= TASK_MAX_DEPTH) {
          return { ok: false, message: "Cannot create subtask — max depth reached (task → subtask → sub-subtask).", errorCode: "validation_error" };
        }
      }
      return {
        ok: true,
        message: `Create task "${args.title}" in ${project.key}`,
        normalizedArgs: parsed.data as Record<string, unknown>,
        projectKey: project.key,
      };
    }

    if (call.tool === "create_subtasks") {
      const args = parsed.data as z.infer<typeof AiToolSchemas.create_subtasks>;
      const project = await Project.findById(args.projectId).select("organizationId key").lean();
      if (!project) return { ok: false, message: "Project not found.", errorCode: "not_found" };
      if (String(project.organizationId) !== organizationId) return { ok: false, message: "Project not in this workspace.", errorCode: "forbidden" };
      await assertProjectPermission(actorUserId, args.projectId, "task.create");
      const parent = await Task.findById(args.parentTaskId).select("projectId organizationId title parentId").lean() as unknown as { projectId: unknown; organizationId: unknown; title: string; parentId?: unknown } | null;
      if (!parent) return { ok: false, message: "Parent task not found.", errorCode: "not_found" };
      if (String(parent.projectId) !== args.projectId) return { ok: false, message: "Parent task not in this project.", errorCode: "validation_error" };
      if (String(parent.organizationId) !== organizationId) return { ok: false, message: "Parent task not in this workspace.", errorCode: "forbidden" };
      // Canonical depth check via taskDepth
      const parentFull = await Task.findById(args.parentTaskId).where("deletedAt").equals(null);
      if (!parentFull) return { ok: false, message: "Parent task not found.", errorCode: "not_found" };
      const depth = await taskDepth(parentFull as unknown as Parameters<typeof taskDepth>[0]);
      if (depth >= TASK_MAX_DEPTH) {
        return { ok: false, message: "Cannot create subtask — max depth reached (task → subtask → sub-subtask).", errorCode: "validation_error" };
      }
      // Validate subtasks dueDates
      for (const sub of args.subtasks) {
        if (sub.dueDate) {
          const d = new Date(sub.dueDate);
          if (isNaN(d.getTime())) return { ok: false, message: `Invalid dueDate for subtask "${sub.title}".`, errorCode: "validation_error" };
        }
      }
      return {
        ok: true,
        message: `Create ${args.subtasks.length} subtasks for "${parent.title}" in ${project.key}`,
        normalizedArgs: parsed.data as Record<string, unknown>,
        projectKey: project.key,
      };
    }

    if (call.tool === "update_task") {
      const args = parsed.data as z.infer<typeof AiToolSchemas.update_task>;
      const project = await Project.findById(args.projectId).select("organizationId").lean();
      if (!project) return { ok: false, message: "Project not found.", errorCode: "not_found" };
      if (String(project.organizationId) !== organizationId) return { ok: false, message: "Project not in this workspace.", errorCode: "forbidden" };
      await assertProjectPermission(actorUserId, args.projectId, "task.update");
      const task = await Task.findById(args.taskId).select("projectId organizationId title").lean();
      if (!task) return { ok: false, message: "Task not found.", errorCode: "not_found" };
      if (String(task.projectId) !== args.projectId) return { ok: false, message: "Task not in this project.", errorCode: "validation_error" };
      if (String(task.organizationId) !== organizationId) return { ok: false, message: "Task not in this workspace.", errorCode: "forbidden" };
      const updates = Object.keys(args).filter((k) => !["projectId", "taskId"].includes(k) && (args as Record<string, unknown>)[k] !== undefined);
      if (updates.length === 0) return { ok: false, message: "No updates provided.", errorCode: "validation_error" };
      if (args.dueDate !== undefined && args.dueDate !== null) {
        const d = new Date(args.dueDate as string);
        if (isNaN(d.getTime())) return { ok: false, message: "Invalid dueDate.", errorCode: "validation_error" };
      }
      return {
        ok: true,
        message: `Update task "${task.title}": ${updates.join(", ")}`,
        normalizedArgs: parsed.data as Record<string, unknown>,
      };
    }

    return { ok: false, message: "Unknown tool.", errorCode: "not_found" };
  } catch (e) {
    if (e instanceof ApiError) {
      return { ok: false, message: e.message, errorCode: e.code };
    }
    console.error("[ai-tools] validateProposal", e);
    return { ok: false, message: "Validation failed.", errorCode: "server_error" };
  }
}

/** Execute a single tool call — permission-checked, bounded. */
export async function executeTool(
  actorUserId: string,
  organizationId: string,
  call: AiToolCall
): Promise<AiToolResult> {
  await connectDb();
  const schema = AiToolSchemas[call.tool];
  const parsed = schema.safeParse(call.args);
  if (!parsed.success) {
    return {
      tool: call.tool,
      ok: false,
      message: `Invalid arguments for ${call.tool}: ${Object.values(parsed.error.flatten().fieldErrors).flat().join(", ")}`,
      errorCode: "validation_error",
    };
  }

  try {
    if (call.tool === "create_task") {
      const args = parsed.data as z.infer<typeof AiToolSchemas.create_task>;
      // Verify project belongs to org and user has permission
      const project = await Project.findById(args.projectId).select("organizationId key").lean();
      if (!project) throw ApiError.notFound("Project not found.");
      if (String(project.organizationId) !== organizationId) throw ApiError.forbidden("Project not in this workspace.");

      await assertProjectPermission(actorUserId, args.projectId, "task.create");

      const dueDate = args.dueDate ? new Date(args.dueDate) : null;
      if (dueDate && isNaN(dueDate.getTime())) throw ApiError.badRequest("Invalid dueDate.");

      if (args.parentId) {
        const parentFull = await Task.findById(args.parentId).where("deletedAt").equals(null);
        if (!parentFull) throw ApiError.notFound("Parent task not found.");
        const depth = await taskDepth(parentFull as unknown as Parameters<typeof taskDepth>[0]);
        if (depth >= TASK_MAX_DEPTH) throw ApiError.unprocessable("Cannot create subtask — max depth reached.");
      }

      const task = await createTask(actorUserId, args.projectId, {
        title: args.title,
        description: args.description,
        status: args.status ?? "todo",
        priority: args.priority ?? "medium",
        assigneeId: args.assigneeId ?? null,
        dueDate,
        parentId: args.parentId ?? null,
      });

      return {
        tool: call.tool,
        ok: true,
        message: `Created task ${project.key}-${task.number}: "${task.title}"`,
        data: { id: task.id, key: `${project.key}-${task.number}`, title: task.title, projectId: args.projectId },
      };
    }

    if (call.tool === "create_subtasks") {
      const args = parsed.data as z.infer<typeof AiToolSchemas.create_subtasks>;
      const project = await Project.findById(args.projectId).select("organizationId key").lean();
      if (!project) throw ApiError.notFound("Project not found.");
      if (String(project.organizationId) !== organizationId) throw ApiError.forbidden("Project not in this workspace.");

      await assertProjectPermission(actorUserId, args.projectId, "task.create");

      // Verify parent task belongs to same project and org
      const parent = await Task.findById(args.parentTaskId).select("projectId organizationId title parentId").lean() as unknown as { projectId: unknown; organizationId: unknown; title: string; parentId?: unknown } | null;
      if (!parent) throw ApiError.notFound("Parent task not found.");
      if (String(parent.projectId) !== args.projectId) throw ApiError.badRequest("Parent task not in this project.");
      if (String(parent.organizationId) !== organizationId) throw ApiError.forbidden("Parent task not in this workspace.");

      // Canonical depth check
      const parentFull = await Task.findById(args.parentTaskId).where("deletedAt").equals(null);
      if (!parentFull) throw ApiError.notFound("Parent task not found.");
      const depth = await taskDepth(parentFull as unknown as Parameters<typeof taskDepth>[0]);
      if (depth >= TASK_MAX_DEPTH) throw ApiError.unprocessable("Cannot create subtask — max depth reached (task → subtask → sub-subtask).");

      const created: { id: string; key: string; title: string }[] = [];
      for (const sub of args.subtasks) {
        const dueDate = sub.dueDate ? new Date(sub.dueDate) : null;
        if (dueDate && isNaN(dueDate.getTime())) continue;
        const task = await createTask(actorUserId, args.projectId, {
          title: sub.title,
          description: sub.description,
          priority: sub.priority ?? "medium",
          assigneeId: sub.assigneeId ?? null,
          dueDate,
          parentId: args.parentTaskId,
          status: "todo",
        });
        created.push({ id: task.id, key: `${project.key}-${task.number}`, title: task.title });
      }

      return {
        tool: call.tool,
        ok: true,
        message: `Created ${created.length} subtasks for "${parent.title}": ${created.map((c) => c.key).join(", ")}`,
        data: { parentId: args.parentTaskId, subtasks: created },
      };
    }

    if (call.tool === "update_task") {
      const args = parsed.data as z.infer<typeof AiToolSchemas.update_task>;
      const project = await Project.findById(args.projectId).select("organizationId").lean();
      if (!project) throw ApiError.notFound("Project not found.");
      if (String(project.organizationId) !== organizationId) throw ApiError.forbidden("Project not in this workspace.");

      await assertProjectPermission(actorUserId, args.projectId, "task.update");

      const task = await Task.findById(args.taskId).select("projectId organizationId").lean();
      if (!task) throw ApiError.notFound("Task not found.");
      if (String(task.projectId) !== args.projectId) throw ApiError.badRequest("Task not in this project.");
      if (String(task.organizationId) !== organizationId) throw ApiError.forbidden("Task not in this workspace.");

      const updates: Record<string, unknown> = {};
      if (args.title) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.status) updates.status = args.status;
      if (args.priority) updates.priority = args.priority;
      if (args.assigneeId !== undefined) updates.assigneeId = args.assigneeId;
      if (args.dueDate !== undefined) {
        if (args.dueDate === null) updates.dueDate = null;
        else {
          const d = new Date(args.dueDate);
          if (isNaN(d.getTime())) throw ApiError.badRequest("Invalid dueDate.");
          updates.dueDate = d;
        }
      }

      if (Object.keys(updates).length === 0) {
        return { tool: call.tool, ok: false, message: "No updates provided.", errorCode: "validation_error" };
      }

      const updated = await updateTask(actorUserId, args.projectId, args.taskId, updates as Record<string, unknown> & { title?: string });

      return {
        tool: call.tool,
        ok: true,
        message: `Updated task ${updated.key}: ${Object.keys(updates).join(", ")}`,
        data: { id: updated.id, key: updated.key, updates },
      };
    }

    return { tool: call.tool, ok: false, message: "Unknown tool.", errorCode: "not_found" };
  } catch (e) {
    if (e instanceof ApiError) {
      return { tool: call.tool, ok: false, message: e.message, errorCode: e.code };
    }
    console.error("[ai-tools]", e);
    return { tool: call.tool, ok: false, message: "Failed to execute tool.", errorCode: "server_error" };
  }
}

/** Execute multiple tool calls sequentially, bounded. */
export async function executeTools(
  actorUserId: string,
  organizationId: string,
  calls: AiToolCall[]
): Promise<AiToolResult[]> {
  const results: AiToolResult[] = [];
  for (const call of calls.slice(0, 3)) {
    // max 3 executions per turn to keep bounded and prevent abuse
    const result = await executeTool(actorUserId, organizationId, call);
    results.push(result);
    // Stop on first failure for safety? Continue to allow partial success but log
    if (!result.ok && result.errorCode === "forbidden") break;
  }
  return results;
}
