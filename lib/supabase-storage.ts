import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_STORAGE_BUCKET = "OSgenerasolutions";

export function supabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
}

export function supabaseServiceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET;
}

export function hasSupabaseStore(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!hasSupabaseStore()) {
    throw new Error(
      "Supabase Storage no está configurado. Defina NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  if (!admin) {
    admin = createClient(supabaseUrl(), supabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export function storageJsonPath(folder: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${folder.replace(/^\/+|\/+$/g, "")}/${safe}.json`;
}

export async function storageGetJson<T>(path: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin()
    .storage.from(storageBucket())
    .download(path);
  if (error || !data) return null;
  const text = await data.text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

export async function storagePutJson(
  path: string,
  value: unknown
): Promise<void> {
  const body = new Blob([JSON.stringify(value)], {
    type: "application/json",
  });
  const { error } = await supabaseAdmin()
    .storage.from(storageBucket())
    .upload(path, body, {
      upsert: true,
      contentType: "application/json",
      cacheControl: "0",
    });
  if (error) {
    throw new Error(`Supabase Storage (subida): ${error.message}`);
  }
}

export async function storageRemove(path: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .storage.from(storageBucket())
    .remove([path]);
  if (error) {
    throw new Error(`Supabase Storage (borrado): ${error.message}`);
  }
}
