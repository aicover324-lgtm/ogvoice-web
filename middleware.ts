import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/app/:path*",
    "/api/voices/:path*",
    "/api/assets/:path*",
    "/api/models/:path*",
    "/api/uploads/:path*",
    "/api/generate/:path*",
    "/api/stripe/checkout",
    "/api/stripe/portal",
  ],
};
