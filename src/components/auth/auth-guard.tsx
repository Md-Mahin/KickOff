"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_PATHS = ["/sign-in", "/sign-up"];

/**
 * Client-Side Auth Guard:
 * Complements server-side Next.js middleware by verifying user session state during client-side SPA navigation.
 * Redirects unauthenticated requests to /sign-in while preserving target redirect URL.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isPublic = PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

    const hasCookie = document.cookie
      .split("; ")
      .some((item) => item.trim().startsWith("kickoff_session="));

    if (!hasCookie && !isPublic) {
      const redirectUrl =
        pathname && pathname !== "/"
          ? `/sign-in?redirect=${encodeURIComponent(pathname)}`
          : "/sign-in";
      router.replace(redirectUrl);
    }
  }, [pathname, router]);

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isPublic) {
    return <>{children}</>;
  }

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}

