import mongoose from "mongoose";

// Cache the Mongoose connection between Next.js development reloads.
// This avoids opening a new database connection for every request.
let cached = globalThis.__mongooseCache;

if (!cached) {
  cached = { connection: null, promise: null };
  globalThis.__mongooseCache = cached;
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing. Configure it in your .env file.");
  }

  if (cached.connection) return cached.connection;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      // Keep connection pooling bounded for a small SaaS instance.
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    });
  }

  try {
    cached.connection = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.connection;
}
