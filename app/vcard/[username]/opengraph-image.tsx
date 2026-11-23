import { OG_SIZE, OG_TYPE, renderOgImage } from "@/lib/og-image";
import { GENERA_TAGLINE, getVCardProfile } from "./profiles";

export const runtime = "nodejs";
export const alt = "vCard Digital · Genera Solutions SAS";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function VCardOpenGraphImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = getVCardProfile(username);
  return renderOgImage({
    kicker: profile.company,
    title: profile.fullName,
    subtitle: profile.tagline || profile.role || GENERA_TAGLINE,
  });
}
