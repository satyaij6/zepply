import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/*
 * Encryption for third-party access tokens at rest (AES-256-GCM). A leaked database copy alone can't
 * be used to post or send DMs as our users; it also takes TOKEN_ENCRYPTION_KEY, which lives only in
 * the hosting environment. Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
const PREFIX = "enc:v1:";

function key() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return bytes;
}

export function encryptToken(plain: string): string {
  if (plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** Decrypts a stored token. Values saved before encryption existed are returned as they are. */
export function decryptToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const [iv, tag, data] = stored.slice(PREFIX.length).split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export const isEncrypted = (stored: string) => stored.startsWith(PREFIX);
