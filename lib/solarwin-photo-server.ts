import { persistGet, persistSet } from "@/lib/persist";

/** Solo letras, números y guiones: el id llega del cliente. */
export function cleanPhotoId(id: string): string {
  return String(id || "").replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 80);
}

function photoKey(id: string) {
  return `genera:solarwin-foto:${cleanPhotoId(id)}`;
}

export const MAX_PHOTO_CHARS = 450_000;

export async function saveSolarwinPhoto(
  id: string,
  dataUrl: string
): Promise<void> {
  const clean = cleanPhotoId(id);
  if (!clean) throw new Error("Id de foto inválido.");
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("La foto debe ser una imagen.");
  }
  if (dataUrl.length > MAX_PHOTO_CHARS) {
    throw new Error("La foto es demasiado pesada.");
  }
  await persistSet(photoKey(clean), { id: clean, dataUrl });
}

export async function getSolarwinPhoto(id: string): Promise<string | null> {
  const clean = cleanPhotoId(id);
  if (!clean) return null;
  try {
    const stored = await persistGet<{ dataUrl?: string }>(photoKey(clean));
    return stored?.dataUrl || null;
  } catch {
    return null;
  }
}
