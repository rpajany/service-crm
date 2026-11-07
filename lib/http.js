import { NextResponse } from "next/server";

// Consistent JSON error shape for API handlers.
export function apiError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Normalize database duplicate-key errors without leaking database internals.
export function isDuplicateKeyError(error) {
  return error?.code === 11000;
}
