import type { Metadata } from "next";
import VCardClient from "./vcard-client";
import { GENERA_TAGLINE, getVCardProfile } from "./profiles";

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = getVCardProfile(username);
  const isGenera = profile.design === "genera";
  const title = isGenera
    ? `${profile.fullName} | ${profile.company}`
    : `${profile.fullName} | vCard Digital`;
  const description = isGenera
    ? `${profile.role}. ${profile.tagline || GENERA_TAGLINE}`
    : `${profile.role} · ${profile.company}`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: profile.company,
      locale: "es_CO",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function VCardPage({ params }: PageProps) {
  return <VCardClient params={params} />;
}
