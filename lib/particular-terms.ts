import type { ParticularTerm } from "@/types/proposal";

export function cleanParticularTerms(
  terms: ParticularTerm[] | null | undefined
): ParticularTerm[] {
  if (!Array.isArray(terms)) return [];
  return terms
    .map((term, index) => ({
      id: String(term?.id || `particular-${index + 1}`),
      title: String(term?.title || "").trim(),
      body: String(term?.body || "").trim(),
    }))
    .filter((term) => term.title || term.body);
}
