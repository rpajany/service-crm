import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_ONLY_PATHS = ["/company-profile", "/settings", "/users"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAdminOnly = ADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  if (!isAdminOnly) return NextResponse.next();

  const token = request.cookies.get("hsc_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error("Invalid session configuration");
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: "hardware-service-crm",
      audience: "hardware-service-crm-web"
    });
    if (payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-protected-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/company-profile/:path*", "/settings/:path*", "/users/:path*"]
};
