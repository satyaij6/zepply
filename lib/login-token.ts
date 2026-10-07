import { createHmac, timingSafeEqual } from "crypto";

/*
 * Proof that lets the "instagram" sign-in provider log someone in. Only the Instagram callback mints
 * one, after Meta has confirmed which account they own, and it never leaves the server. Signed with
 * the auth secret and valid for two minutes, so a bare user id can never be turned into a session.
 */
const TTL_MS = 2 * 60 * 1000;

const secret = () => process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createLoginToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The user id inside a valid, unexpired token; null for anything else. */
export function verifyLoginToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !secret()) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const { userId, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof userId === "string" && typeof exp === "number" && exp > Date.now() ? userId : null;
  } catch {
    return null;
  }
}
