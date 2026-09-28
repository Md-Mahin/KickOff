import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public pages that do not require an active session
const PUBLIC_PATHS = ["/sign-in", "/sign-up"];

/**
 * Next.js 16 Proxy Convention:
 * Replaces deprecated middleware convention to intercept and validate requests before rendering.
 * Any unauthenticated request to protected routes is intercepted and redirected to /sign-in.
 * Authenticated users attempting to visit /sign-in or /sign-up are redirected to home (/).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, Next.js internal chunks, favicon, and API routes to pass through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("kickoff_session")?.value;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  // 1. Unauthenticated user accessing protected route -> redirect to /sign-in
  if (!sessionCookie && !isPublicPath) {
    const signInUrl = new URL("/sign-in", request.url);
    if (pathname !== "/") {
      signInUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  // 2. Already authenticated user visiting /sign-in or /sign-up -> redirect to home
  if (sessionCookie && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Named alias and default export for full backwards compatibility
export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    /*
     * Intercept all page requests while excluding static resources, Next.js internals, and API endpoints
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
