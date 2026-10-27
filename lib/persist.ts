import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  hasSupabaseStore,
  storageGetJson,
  storageJsonPath,
  storagePutJson,
  storageRemove,
} from "@/lib/supabase-storage";

function kvUrl(): string | undefined {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
}

function kvToken(): string | undefined {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
}

export function hasCloudKv(): boolean {
  return Boolean(kvUrl() && kvToken());
}

/** @deprecated Use hasSupabaseStore. Alias para no romper imports viejos. */
export function hasBlobStore(): boolean {
  return hasSupabaseStore();
}

export function hasDurableStore(): boolean {
  return hasSupabaseStore() || hasCloudKv();
}

function objectPath(key: string) {
  return storageJsonPath("genera-kv", key);
}

/** En Vercel el código es de solo lectura; /tmp sí se puede escribir. */
function filePath() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "genera-os", "kv.json");
  }
  return path.join(process.cwd(), "data", "kv.json");
}

let memory: Record<string, unknown> = {};

function readFileMap(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(filePath(), "utf8")) as Record<string, unknown>;
  } catch {
    return { ...memory };
  }
}

function writeFileMap(map: Record<string, unknown>) {
  memory = map;
  try {
    mkdirSync(path.dirname(filePath()), { recursive: true });
    writeFileSync(filePath(), JSON.stringify(map), "utf8");
  } catch {
    /* serverless sin disco: queda en memoria de la instancia */
  }
}

async function kvCommand(cmd: unknown[]): Promise<unknown> {
  const url = kvUrl();
  const token = kvToken();
  if (!url || !token) throw new Error("KV no configurado");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    throw new Error(`KV ${res.status}`);
  }
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

export async function persistGet<T>(key: string): Promise<T | null> {
  if (hasSupabaseStore()) {
    try {
      return await storageGetJson<T>(objectPath(key));
    } catch {
      return null;
    }
  }
  if (hasCloudKv()) {
    const result = await kvCommand(["GET", key]);
    if (result == null) return null;
    if (typeof result === "string") {
      try {
        return JSON.parse(result) as T;
      } catch {
        return result as T;
      }
    }
    return result as T;
  }
  const map = readFileMap();
  return (map[key] as T) ?? null;
}

export async function persistSet<T>(key: string, value: T): Promise<void> {
  if (hasSupabaseStore()) {
    await storagePutJson(objectPath(key), value);
    return;
  }
  if (hasCloudKv()) {
    await kvCommand(["SET", key, JSON.stringify(value)]);
    return;
  }
  const map = readFileMap();
  map[key] = value;
  writeFileMap(map);
}

export async function persistDelete(key: string): Promise<void> {
  if (hasSupabaseStore()) {
    await storageRemove(objectPath(key));
    return;
  }
  if (hasCloudKv()) {
    await kvCommand(["DEL", key]);
    return;
  }
  const map = readFileMap();
  delete map[key];
  writeFileMap(map);
}
