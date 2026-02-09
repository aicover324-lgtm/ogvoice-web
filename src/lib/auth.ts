import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { verify } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

function getIpFromHeaders(headers?: Record<string, string | undefined>) {
  if (!headers) return "unknown";
  const xf = headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return headers["x-real-ip"] || "unknown";
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(
        credentials,
        req?: {
          headers?: Record<string, string | undefined>;
        }
      ) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        // Simple login rate limiting (works with Upstash if configured)
        const ip = getIpFromHeaders(req?.headers);
        const rl = await rateLimit(`login:${ip}:${email}`, { windowMs: 60_000, max: 20 });
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await verify(user.passwordHash, password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
