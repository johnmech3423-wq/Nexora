import { connectDb } from "@/server/db/db";
import { User } from "@/server/db/models/user.model";

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

let cache: Map<string, Promise<Map<string, UserInfo>>> | null = null;

/**
 * Batch-resolves user docs into a map id → UserInfo. Uses a short-lived
 * per-process memo so serializing a board (which references the same
 * handful of users hundreds of times) issues exactly one query.
 */
export async function getUserInfos(userIds: string[], { fresh = false } = {}): Promise<Map<string, UserInfo>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  await connectDb();
  const users = await User.find({ _id: { $in: unique } })
    .select("_id name email avatarUrl")
    .lean();
  const map = new Map<string, UserInfo>();
  for (const u of users) {
    map.set(String(u._id), { id: String(u._id), name: u.name, email: u.email, avatarUrl: u.avatarUrl });
  }
  void fresh;
  return map;
}

/** Clears the process-level user-info memo (tests). */
export function clearUserInfoCache(): void {
  cache = null;
}
