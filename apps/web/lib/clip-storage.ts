/*
 * Supabase Storage for the clip engine: uploads go straight from the browser to the private
 * "clip-sources" bucket through a signed upload URL (Vercel never sees the bytes); the worker
 * writes finished clips to "clip-renders", which the app reads through short-lived signed URLs.
 */
import { BUCKETS } from "./clip-engine";
import { createUpload, objectExists, signedUrls } from "./storage";

/** A one-time URL the browser can PUT the source file to. */
export const createSourceUpload = (path: string) => createUpload(BUCKETS.sources, path);

/** Whether an uploaded source file is really there (the browser may have abandoned the upload). */
export const sourceExists = (path: string) => objectExists(BUCKETS.sources, path);

/** Signed read URLs for finished clips, keyed by object path. Missing paths are simply absent. */
export const signedRenderUrls = (paths: (string | null | undefined)[], expiresIn = 3600) =>
  signedUrls(BUCKETS.renders, paths, expiresIn);
