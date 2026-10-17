import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth/token";

// Cheap first line of defence: bounce visitors without a valid session cookie.
// Real authorisation happens in server code (getCurrentUser / requireRole),
// which also checks the user is still active.
const PUBLIC_PATHS = ["/login", "/setup"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip static assets, Next internals, and the cron/health endpoints (they do their own bearer-token auth).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/(?:cron|health)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
