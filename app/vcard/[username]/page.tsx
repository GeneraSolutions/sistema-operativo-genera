import type { Metadata } from "next";
import VCardClient from "./vcard-client";

export const metadata: Metadata = {
  title: {
    absolute: "vCard Digital | Genera Solutions SAS",
  },
};

export default function VCardPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  return <VCardClient params={params} />;
}
