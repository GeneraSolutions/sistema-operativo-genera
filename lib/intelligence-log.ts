import { readFileSync } from "fs";
import path from "path";
import type { Role } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { persistGet, persistSet } from "@/lib/persist";

export interface IntelligenceLogEntry {
  id: string;
  createdAt: string;
  userId: string;
  username: string;
  userName: string;
  role: Role;
  mode: "specialist" | "mesa";
  specialistLabel: string;
  question: string;
  answer: string;
}

const LOG_KEY = "genera:intel-log";

async function readLog(): Promise<IntelligenceLogEntry[]> {
  const stored = await persistGet<IntelligenceLogEntry[]>(LOG_KEY);
  if (stored && Array.isArray(stored)) return stored;
  try {
    const parsed = JSON.parse(
      readFileSync(path.join(process.cwd(), "data", "intelligence-log.json"), "utf8")
    ) as IntelligenceLogEntry[];
    if (Array.isArray(parsed) && parsed.length) {
      await persistSet(LOG_KEY, parsed);
      return parsed;
    }
  } catch {
    /* empty */
  }
  return [];
}

export async function appendIntelligenceLog(
  user: SessionUser,
  input: {
    mode: "specialist" | "mesa";
    specialistLabel: string;
    question: string;
    answer: string;
  }
): Promise<IntelligenceLogEntry> {
  const entry: IntelligenceLogEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userId: user.id,
    username: user.username,
    userName: user.name,
    role: user.role,
    mode: input.mode,
    specialistLabel: input.specialistLabel,
    question: input.question.slice(0, 4000),
    answer: input.answer.slice(0, 8000),
  };
  const all = await readLog();
  await persistSet(LOG_KEY, [entry, ...all].slice(0, 500));
  return entry;
}

export async function listVisibleIntelligenceLog(
  viewer: SessionUser
): Promise<IntelligenceLogEntry[]> {
  const all = await readLog();
  return all.filter((entry) => {
    if (entry.userId === viewer.id) return true;
    if (entry.role === "ceo" && viewer.role !== "ceo") return false;
    return true;
  });
}
