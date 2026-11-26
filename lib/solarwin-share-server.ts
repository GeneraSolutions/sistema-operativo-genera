import { hasDurableStore, persistGet, persistSet } from "@/lib/persist";
import {
  hasSupabaseStore,
  storageGetJson,
  storagePutJson,
} from "@/lib/supabase-storage";
import type { SolarwinStatement } from "@/lib/solarwin";

function statementPath(id: string) {
  return `solarwin/${id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`;
}

function persistKey(path: string) {
  return `genera:share:${path.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
}

async function readStatement(id: string): Promise<SolarwinStatement | null> {
  const path = statementPath(id);
  if (hasSupabaseStore()) {
    try {
      const parsed = await storageGetJson<SolarwinStatement>(path);
      if (parsed?.id) return parsed;
    } catch {
      /* try persist */
    }
  }
  const local = await persistGet<SolarwinStatement>(persistKey(path));
  return local?.id ? local : null;
}

export async function saveSolarwinStatement(
  statement: SolarwinStatement
): Promise<void> {
  if (process.env.VERCEL && !hasDurableStore()) {
    throw new Error(
      "El enlace no se puede publicar: configure Supabase Storage (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  const path = statementPath(statement.id);
  await persistSet(persistKey(path), statement);
  if (hasSupabaseStore()) {
    await storagePutJson(path, statement);
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await readStatement(statement.id)) return;
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  throw new Error(
    "La cuenta se envió al almacenamiento pero no se pudo confirmar. Intente de nuevo."
  );
}

export async function getSolarwinStatement(
  id: string
): Promise<SolarwinStatement | null> {
  try {
    return await readStatement(id);
  } catch {
    return null;
  }
}
