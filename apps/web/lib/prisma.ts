import { PrismaClient } from "@prisma/client";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

/*
 * Instagram access tokens are encrypted on every write and decrypted when read, so the rest of the
 * app keeps using `igAccount.accessToken` as plain text and can't forget a step. Decryption only runs
 * when a query actually selects the token. Writes must go through `prisma.instagramAccount.*`:
 * a token written as a nested create from another model would not be encrypted.
 */
function encryptData<T>(data: T): T {
  if (!data || typeof data !== "object" || !("accessToken" in data)) return data;
  const token = (data as { accessToken: unknown }).accessToken;
  return typeof token === "string" ? { ...data, accessToken: encryptToken(token) } : data;
}

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  }).$extends({
    query: {
      instagramAccount: {
        create: ({ args, query }) => query({ ...args, data: encryptData(args.data) }),
        update: ({ args, query }) => query({ ...args, data: encryptData(args.data) }),
        updateMany: ({ args, query }) => query({ ...args, data: encryptData(args.data) }),
        upsert: ({ args, query }) =>
          query({ ...args, create: encryptData(args.create), update: encryptData(args.update) }),
        createMany: ({ args, query }) =>
          query({
            ...args,
            data: Array.isArray(args.data) ? args.data.map(encryptData) : encryptData(args.data),
          }),
      },
    },
    result: {
      instagramAccount: {
        accessToken: {
          needs: { accessToken: true },
          compute: (account) => decryptToken(account.accessToken),
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
