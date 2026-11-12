import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { authAdapter } from "@/lib/auth/adapter";
import { resolveAuthRedirect } from "@/lib/auth/redirect";

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "production" ? undefined : "ars-arcana-development-only-secret");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: authAdapter,
  secret: authSecret,
  trustHost: true,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return false;
      if (!user.email) return false;
      if (profile && "email_verified" in profile && profile.email_verified !== true) {
        return false;
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
    async redirect({ url, baseUrl }) {
      return resolveAuthRedirect(url, baseUrl);
    },
  },
});
