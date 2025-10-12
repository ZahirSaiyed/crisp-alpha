export type SessionData = {
  id: string;
  audioUrl: string;
  tokens: Array<{ word: string; start?: number; end?: number }>;
  durationSec: number;
  summary?: Record<string, unknown>;
};

const mem = new Map<string, SessionData>();

export function saveSession(data: SessionData) {
  mem.set(data.id, data);
}

export function getSession(id: string): SessionData | undefined {
  return mem.get(id);
} 