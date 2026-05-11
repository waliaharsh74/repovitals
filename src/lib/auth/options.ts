import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db/prisma";
import { envValue, getAuthSecret } from "@/lib/auth/env";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    GitHubProvider({
      clientId: envValue("GITHUB_CLIENT_ID", "AUTH_GITHUB_ID"),
      clientSecret: envValue("GITHUB_CLIENT_SECRET", "AUTH_GITHUB_SECRET"),
      authorization: { params: { scope: "read:user repo" } },
    }),
    GoogleProvider({
      clientId: envValue("GOOGLE_CLIENT_ID", "AUTH_GOOGLE_ID"),
      clientSecret: envValue("GOOGLE_CLIENT_SECRET", "AUTH_GOOGLE_SECRET"),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
  secret: getAuthSecret(),
};
