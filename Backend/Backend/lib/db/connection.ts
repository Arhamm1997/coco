import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI is not defined. Add it to your .env.local file.\n' +
    'Example: MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/seo-optimizer'
  );
}

/**
 * Global cache to reuse the connection across Next.js hot-reloads in dev mode.
 * Without this, every file change would open a new connection.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend NodeJS global to persist the cache between module reloads
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
  // Return existing connection if already established
  if (cached.conn) {
    return cached.conn;
  }

  // Reuse an in-flight connection promise (prevents multiple parallel connects)
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
      maxPoolSize: 10,          // Max simultaneous connections
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset promise so next call retries the connection
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
