import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Browsing the catalog (/generate index, /category/*) is public so users can see
// presets without logging in. Starting a generation (/generate/<presetId>) and all
// account surfaces require auth.
const PROTECTED_ROUTES = ["/gallery", "/orders", "/settings", "/output", "/progress", "/print", "/admin", "/wallet"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected =
    PROTECTED_ROUTES.some((r) => pathname.startsWith(r)) ||
    // /generate is the public catalog; /generate/<presetId> starts a paid generation.
    pathname.startsWith("/generate/");
  const isAuthPage = pathname === "/auth";

  // Public catalog routes don't use the user at all, so skip auth here. getUser()
  // is a network round-trip to the Supabase auth server, and the matcher runs on
  // every navigation + <Link> prefetch — making it the main per-route latency.
  // Only protected routes and /auth need it. The browser Supabase client
  // auto-refreshes the session, so cookies stay fresh while browsing public pages.
  if (!isProtected && !isAuthPage) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session (do NOT use getSession — use getUser per @supabase/ssr docs)
  const { data: { user } } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect logged-in users away from auth page
  if (pathname === "/auth" && user) {
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = next;
    redirectUrl.searchParams.delete("next");
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
