"use client";

import { useEffect, useState } from "react";
import { loadProposalRemote } from "@/lib/proposal-store";
import type { EpcProposal } from "@/types/proposal";

export function useProposalDoc(id: string) {
  const [proposal, setProposal] = useState<EpcProposal | null | undefined>(
    undefined
  );
  useEffect(() => {
    let cancelled = false;
    loadProposalRemote(id).then((p) => {
      if (!cancelled) setProposal(p);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return proposal;
}
