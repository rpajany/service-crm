import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "hsc_session";
const SESSION_DURATION_SECONDS = 60 * 60; // One hour.

function getJwtKey() {
  const secret = process.env.JWT_SECRET;

  // A weak or missing secret should fail closed instead of issuing tokens.
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a strong secret of at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user) {
  // Only include the minimum identity claims needed by the app.
  return new SignJWT({
    companyId: String(user.companyId),
    role: user.role,
    username: user.username
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user._id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .setIssuer("hardware-service-crm")
    .setAudience("hardware-service-crm-web")
    .sign(getJwtKey());
}

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, getJwtKey(), {
    algorithms: ["HS256"],
    issuer: "hardware-service-crm",
    audience: "hardware-service-crm-web"
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.companyId !== "string" ||
    !["admin", "engineer", "staff"].includes(payload.role)
  ) {
    throw new Error("Invalid session claims");
  }

  return {
    userId: payload.sub,
    companyId: payload.companyId,
    role: payload.role,
    username: String(payload.username || "")
  };
}

export async function getSession() {
  // cookies() is async in current Next.js App Router versions.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    // Expired, malformed, or invalid tokens are treated as logged out.
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  };
}
