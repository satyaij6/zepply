import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { verifyLoginToken } from "@/lib/login-token";

export const authConfig: NextAuthConfig = {
  providers: [
    // Sign up and log in. Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.
    Google,
    // Log in with Instagram, for accounts that already have it connected. Only the Instagram callback
    // can use this: it needs a server-signed token (lib/login-token.ts), never a user id from the browser.
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
          include: { igAccounts: { select: { igUsername: true, igProfilePic: true } } },
        });
        if (!user) return null;

        return {
          id: user.id,
          name: user.name || user.igAccounts[0]?.igUsername,
          email: user.email,
          image: user.igAccounts[0]?.igProfilePic || null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    // Google accounts must have a verified email, since the email is what identifies the Zepply account.
    async signIn({ account, profile }) {
      if (account?.provider === "google") return profile?.email_verified === true;
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        // Google's id isn't ours: find or create the Zepply user for this email.
        const prisma = (await import("@/lib/prisma")).default;
        const email = user.email.toLowerCase();
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: user.name },
        });
        token.userId = dbUser.id;
        token.name = dbUser.name || user.name;
        token.picture = user.image;
      } else if (user) {
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
    error: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
