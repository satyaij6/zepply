import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";

export const authConfig: NextAuthConfig = {
  providers: [
    // Instagram OAuth is handled manually via /api/instagram/connect
    // We use a credentials provider to create sessions after Instagram OAuth
    CredentialsProvider({
      id: "instagram",
      name: "Instagram",
      credentials: {
        userId: { label: "User ID", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.userId) return null;

        const user = await prisma.user.findUnique({
          where: { id: credentials.userId as string },
          include: { igAccounts: true },
        });

        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
    CredentialsProvider({
      id: "email-login",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        let user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          user = await prisma.user.create({
            data: { email: credentials.email as string },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
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
