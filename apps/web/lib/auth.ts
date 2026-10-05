import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      id: "instagram",
      name: "Instagram",
      credentials: {
        userId: { label: "User ID", type: "text" },
        username: { label: "Username", type: "text" },
        igUserId: { label: "IG User ID", type: "text" },
        profilePic: { label: "Profile Pic", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.userId) return null;

        // First try database lookup
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const user = await prisma.user.findUnique({
            where: { id: credentials.userId as string },
            include: { igAccounts: true },
          });

          if (user) {
            return {
              id: user.id,
              name: user.igAccounts?.[0]?.igUsername || user.name,
              email: user.email,
              image: user.igAccounts?.[0]?.igProfilePic || null,
            };
          }
        } catch (dbError) {
          console.warn("⚠️ DB unreachable in authorize, using credential data");
        }

        // Fallback: return user from the credentials passed directly
        // This works when database is unreachable (local dev)
        return {
          id: credentials.userId as string,
          name: (credentials.username as string) || "User",
          image: (credentials.profilePic as string) || null,
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
