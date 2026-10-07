import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyLoginToken } from "@/lib/login-token";

export const authConfig: NextAuthConfig = {
  providers: [
    // Only the Instagram callback can use this: it needs a server-signed token (lib/login-token.ts),
    // never a user id from the browser.
    CredentialsProvider({
      id: "instagram",
      name: "Instagram",
      credentials: { token: { type: "text" } },
      async authorize(credentials) {
        const userId = typeof credentials?.token === "string" ? verifyLoginToken(credentials.token) : null;
        if (!userId) return null;

        const prisma = (await import("@/lib/prisma")).default;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { igAccounts: true },
        });
        if (!user) return null;

        return {
          id: user.id,
          name: user.igAccounts?.[0]?.igUsername || user.name,
          email: user.email,
          image: user.igAccounts?.[0]?.igProfilePic || null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
