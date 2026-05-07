import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { getAuthSecret } from "@/lib/auth/env";

export default withAuth(
  function middleware(request) {
    if (request.nextUrl.pathname.startsWith("/api/") && !request.nextauth.token) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign in to analyze repositories and view saved reports.",
          },
        },
        { status: 401 },
      );
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    secret: getAuthSecret(),
    callbacks: {
      authorized({ req, token }) {
        if (req.nextUrl.pathname.startsWith("/api/")) {
          return true;
        }

        return Boolean(token);
      },
    },
  },
);

export const config = {
  matcher: [
    "/analyze",
    "/analyze/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/reports",
    "/reports/:path*",
    "/api/analyze",
    "/api/analyze/:path*",
    "/api/reports",
    "/api/reports/:path*",
  ],
};
