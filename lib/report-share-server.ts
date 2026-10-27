import {
  hasDurableStore,
  persistGet,
  persistSet,
} from "@/lib/persist";
import {
  hasSupabaseStore,
  storageGetJson,
  storagePutJson,
} from "@/lib/supabase-storage";
import type { TechnicalReport } from "@/lib/technical-reports";
import { rulingPhotos, type PhotoRuling } from "@/lib/photo-ruling";

function reportPath(id: string) {
  return `informes/${id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`;
}

function rulingPath(id: string) {
  return `dictamenes/${id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`;
}

function compactReport(report: TechnicalReport, dropPhotos = false): TechnicalReport {
  const photos = dropPhotos
    ? []
    : (report.photos ?? [])
        .filter((p) => p.dataUrl && p.dataUrl.length < 120_000)
        .slice(0, 12);
  return { ...report, photos };
}

function compactRuling(ruling: PhotoRuling, dropImage = false): PhotoRuling {
  const photos = dropImage
    ? []
    : rulingPhotos(ruling)
        .filter((p) => p.dataUrl && p.dataUrl.length < 140_000)
        .slice(0, 12);
  const cover = photos[0];
  return {
    ...ruling,
    photos,
    imageDataUrl: cover?.dataUrl || "",
    imageCaption: cover?.caption || ruling.imageCaption || "",
  };
}

function persistKey(path: string) {
  return `genera:share:${path.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
}

async function readJson<T extends { id?: string }>(
  path: string
): Promise<T | null> {
  if (hasSupabaseStore()) {
    try {
      const parsed = await storageGetJson<T>(path);
      if (parsed?.id) return parsed;
    } catch {
      /* try persist */
    }
  }
  const local = await persistGet<T>(persistKey(path));
  return local?.id ? local : null;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await persistSet(persistKey(path), value);
  if (hasSupabaseStore()) {
    await storagePutJson(path, value);
  }
}

async function confirmWrite<T extends { id?: string }>(
  path: string
): Promise<T | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const stored = await readJson<T>(path);
    if (stored) return stored;
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  return null;
}

function requireStore() {
  if (process.env.VERCEL && !hasDurableStore()) {
    throw new Error(
      "El enlace no se puede publicar: configure Supabase Storage (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
}

export async function saveSharedReport(report: TechnicalReport): Promise<void> {
  requireStore();
  let slim = compactReport(report);
  try {
    await writeJson(reportPath(slim.id), slim);
  } catch {
    slim = compactReport(report, true);
    await writeJson(reportPath(slim.id), slim);
  }
  const stored = await confirmWrite<TechnicalReport>(reportPath(slim.id));
  if (!stored) {
    throw new Error(
      "El informe se envió al almacenamiento pero no se pudo confirmar. Intente de nuevo."
    );
  }
}

export async function getSharedReport(
  id: string
): Promise<TechnicalReport | null> {
  try {
    return await readJson<TechnicalReport>(reportPath(id));
  } catch {
    return null;
  }
}

export async function saveSharedRuling(ruling: PhotoRuling): Promise<void> {
  requireStore();
  let slim = compactRuling(ruling);
  try {
    await writeJson(rulingPath(slim.id), slim);
  } catch {
    slim = compactRuling(ruling, true);
    await writeJson(rulingPath(slim.id), slim);
  }
  const stored = await confirmWrite<PhotoRuling>(rulingPath(slim.id));
  if (!stored) {
    throw new Error(
      "El dictamen se envió al almacenamiento pero no se pudo confirmar. Intente de nuevo."
    );
  }
}

export async function getSharedRuling(id: string): Promise<PhotoRuling | null> {
  try {
    return await readJson<PhotoRuling>(rulingPath(id));
  } catch {
    return null;
  }
}
