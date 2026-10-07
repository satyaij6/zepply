/*
 * Supabase Storage, shared by the clip engine and promo reels. Every bucket is private:
 * browsers upload through one-time signed upload URLs and read through short-lived signed URLs.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Service-role client, created on first use so missing settings fail the request rather than the build. */
export function storage() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client.storage;
}

const ready = new Set<string>();

/** Creates a private bucket the first time it's needed. */
export async function ensureBucket(name: string) {
  if (ready.has(name)) return;
  const { data } = await storage().getBucket(name);
  if (!data) {
    const { error } = await storage().createBucket(name, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  ready.add(name);
}

/** A one-time URL the browser can PUT a file to. */
export async function createUpload(bucket: string, path: string) {
  await ensureBucket(bucket);
  const { data, error } = await storage().from(bucket).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

/** Whether an uploaded file is really there (the browser may have abandoned the upload). */
export async function objectExists(bucket: string, path: string) {
  const slash = path.lastIndexOf("/");
  const { data } = await storage()
    .from(bucket)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return !!data?.length;
}

/** Signed read URLs keyed by object path. Missing paths are simply absent. */
export async function signedUrls(bucket: string, paths: (string | null | undefined)[], expiresIn = 3600) {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  if (!wanted.length) return new Map<string, string>();
  const { data, error } = await storage().from(bucket).createSignedUrls(wanted, expiresIn);
  if (error) throw error;
  return new Map(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}
