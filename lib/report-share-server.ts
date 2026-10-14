import { get as blobGet, put as blobPut } from "@vercel/blob";
import {
  hasBlobStore,
  hasDurableStore,
  persistGet,
  persistSet,
} from "@/lib/persist";
import type { TechnicalReport } from "@/lib/technical-reports";
import { rulingPhotos, type PhotoRuling } from "@/lib/photo-ruling";

function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token ? { token } : {};
}

function reportPath(id: string) {
  return `informes/${id}.json`;
}

function rulingPath(id: string) {
  return `dictamenes/${id}.json`;
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
  if (hasBlobStore()) {
    try {
      const result = await blobGet(path, {
        access: "private",
        useCache: false,
        ...blobAuth(),
      });
      if (result && result.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        if (text) {
          const parsed = JSON.parse(text) as T;
          if (parsed?.id) return parsed;
        }
      }
    } catch {
      /* try persist */
    }
  }
  const local = await persistGet<T>(persistKey(path));
  return local?.id ? local : null;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await persistSet(persistKey(path), value);
  if (!hasBlobStore()) return;
  await blobPut(path, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...blobAuth(),
  });
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
      "El enlace no se puede publicar: falta almacenamiento duradero en Vercel."
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
