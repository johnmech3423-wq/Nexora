import { connectDb } from "@/server/db/db";
import { ActivityLog } from "@/server/db/models/activity-log.model";

export interface LogActivityInput {
  organizationId: string | null;
  action: string;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string;
}

/**
 * Appends an entry to the (organization) audit log. Designed to never
 * throw: audit must not break the primary operation it records.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await connectDb();
    await ActivityLog.create({
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      projectId: input.projectId ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
    });
  } catch (error) {
    console.error("[activity] failed to persist log:", error);
  }
}
