import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { config } from "../config.js";
import { AppError } from "./errors.js";

// File storage (Supabase). The bucket must be PRIVATE: clients only ever get
// short-lived signed URLs.

const SIGNED_URL_TTL_SECONDS = 60 * 60;

let client: SupabaseClient | undefined;

const bucket = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET } = config;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_BUCKET) {
    throw new AppError(503, "File storage is not configured", "storage_unavailable");
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    realtime: { transport: ws as never },
  });
  return client.storage.from(SUPABASE_BUCKET);
};

export const storage = {
  async upload(path: string, data: Buffer, contentType: string) {
    const { error } = await bucket().upload(path, data, { contentType });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  },

  async download(path: string) {
    const { data, error } = await bucket().download(path);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
  },

  async remove(path: string) {
    const { error } = await bucket().remove([path]);
    if (error) throw new Error(`Storage remove failed: ${error.message}`);
  },

  /** Signed URLs in the same order as `paths`; null where signing failed. */
  async signedUrls(paths: string[]): Promise<(string | null)[]> {
    if (paths.length === 0) return [];
    const { data, error } = await bucket().createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`Signing URLs failed: ${error.message}`);
    return paths.map((_, i) => data?.[i]?.signedUrl ?? null);
  },
};
