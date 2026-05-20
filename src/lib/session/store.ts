import type { ModuleId, SessionState } from "../segue/types";

/**
 * In-memory session store. Pinned to globalThis so it survives Next.js' per-route
 * bundle isolation in dev mode. Suitable for MVP / single-process deployments.
 * For multi-process production, swap to Redis or a DB.
 */
const GLOBAL_KEY = "__pharmacy_ai_sessions__";
type StoreMap = Map<string, SessionState>;

function getStore(): StoreMap {
  const g = globalThis as unknown as { [GLOBAL_KEY]?: StoreMap };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
  return g[GLOBAL_KEY]!;
}

export function createSession(moduleId: ModuleId): SessionState {
  const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const s: SessionState = {
    id,
    moduleId,
    startedAt: Date.now(),
    messages: [],
    actions: [],
    context: {}
  };
  getStore().set(id, s);
  return s;
}

export function getSession(id: string): SessionState | undefined {
  return getStore().get(id);
}

export function saveSession(s: SessionState) {
  getStore().set(s.id, s);
}

export function listSessions(): SessionState[] {
  return Array.from(getStore().values()).sort((a, b) => b.startedAt - a.startedAt);
}
