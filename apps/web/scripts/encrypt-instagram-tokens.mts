/*
 * One-off: encrypts Instagram access tokens saved before encryption existed. Safe to run more than
 * once (already-encrypted tokens are skipped). Uses the plain Prisma client on purpose, so it reads
 * the stored values rather than the decrypted ones.
 *
 *   cd apps/web && node --env-file=.env.local scripts/encrypt-instagram-tokens.mts
 */
import { PrismaClient } from "@prisma/client";
import { encryptToken, isEncrypted } from "../lib/token-crypto.ts";

const db = new PrismaClient();
const accounts = await db.instagramAccount.findMany({ select: { id: true, accessToken: true } });
const pending = accounts.filter((a) => !isEncrypted(a.accessToken));

for (const a of pending) {
  await db.instagramAccount.update({ where: { id: a.id }, data: { accessToken: encryptToken(a.accessToken) } });
}
console.log(`Encrypted ${pending.length} of ${accounts.length} Instagram token(s).`);
await db.$disconnect();
