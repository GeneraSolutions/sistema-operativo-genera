import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { get as blobGetFile, put as blobPutFile } from "@vercel/blob";

function kvUrl(): string | undefined {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
}

function kvToken(): string | undefined {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
}

export function hasCloudKv(): boolean {
  return Boolean(kvUrl() && kvToken());
}

export function hasBlobStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function hasDurableStore(): boolean {
  return hasCloudKv() || hasBlobStore();
}

function blobPath(key: string) {
  return `genera-kv/${key.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`;
}

function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token ? { token } : {};
}

async function blobGet<T>(key: string): Promise<T | null> {
  const result = await blobGetFile(blobPath(key), {
    access: "private",
    useCache: false,
    ...blobAuth(),
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

async function blobSet<T>(key: string, value: T): Promise<void> {
  await blobPutFile(blobPath(key), JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...blobAuth(),
  });
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
  if (hasBlobStore()) {
    try {
      return await blobGet<T>(key);
    } catch {
      return null;
    }
  }
  const map = readFileMap();
  return (map[key] as T) ?? null;
}

export async function persistSet<T>(key: string, value: T): Promise<void> {
  if (hasCloudKv()) {
    await kvCommand(["SET", key, JSON.stringify(value)]);
    return;
  }
  if (hasBlobStore()) {
    await blobSet(key, value);
    return;
  }
  const map = readFileMap();
  map[key] = value;
  writeFileMap(map);
}
