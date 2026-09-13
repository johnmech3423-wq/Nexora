import mongoose from "mongoose";
import { env } from "@/lib/env";

/**
 * Global singleton connection (safe under Next.js dev hot-reload and
 * serverless cold starts). Reuses the warm connection when present.
 */
type Cached = { conn: mongoose.Connection | null; promise: Promise<typeof mongoose> | null };
const globalForMongoose = globalThis as unknown as { nexoraMongoose?: Cached };

const cached: Cached = globalForMongoose.nexoraMongoose ?? { conn: null, promise: null };
globalForMongoose.nexoraMongoose = cached;

export async function connectDb(): Promise<mongoose.Connection> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(env.databaseUrl(), {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      minPoolSize: env.isProd ? 1 : 0,
      autoIndex: !env.isProd, // prod uses pre-built indexes via script (avoid dev-index drift on hot paths)
    });
  }

  try {
    const db = await cached.promise;
    cached.conn = db.connection;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}

export async function disconnectDb(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}

export function isObjectId(value: unknown): value is mongoose.Types.ObjectId {
  return mongoose.isObjectIdOrHexString(value);
}

export { mongoose };
