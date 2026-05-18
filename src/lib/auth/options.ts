import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db/prisma";
import { envValue, getAuthSecret } from "@/lib/auth/env";
import { persistGithubAccountTokens } from "@/lib/github/oauth";

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
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.id = user.id;
      }

      if (user?.id && account?.provider === "github") {
        await persistGithubAccountTokens(user.id, account);
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
