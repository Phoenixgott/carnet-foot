// Cache des réponses d'API dans le stockage local, pour économiser les requêtes.
const PREFIX = 'over15:cache:';
const QUOTA_KEY = 'over15:quota';

interface Entry<T> {
  t: number;
  v: T;
}

export function cacheGet<T>(key: string, ttlMs: number): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const e = JSON.parse(raw) as Entry<T>;
    if (Date.now() - e.t > ttlMs) return undefined;
    return e.v;
  } catch {
    return undefined;
  }
}

export function cacheSet<T>(key: string, v: T) {
  const payload = JSON.stringify({ t: Date.now(), v } satisfies Entry<T>);
  try {
    localStorage.setItem(PREFIX + key, payload);
  } catch {
    // Stockage plein : on vide les plus anciennes entrées et on réessaie une fois.
    pruneCache(0.5);
    try {
      localStorage.setItem(PREFIX + key, payload);
    } catch {
      /* tant pis, pas de cache */
    }
  }
}

function cacheKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

/** Supprime les entrées de plus de 3 jours, ou une fraction des plus anciennes. */
export function pruneCache(fraction = 0) {
  try {
    const items = cacheKeys().map((k) => {
      let t = 0;
      try {
        t = (JSON.parse(localStorage.getItem(k) ?? '{}') as Entry<unknown>).t ?? 0;
      } catch {
        /* entrée illisible */
      }
      return { k, t };
    });
    const old = Date.now() - 3 * 86400000;
    items.filter((i) => i.t < old).forEach((i) => localStorage.removeItem(i.k));
    if (fraction > 0) {
      const rest = items.filter((i) => i.t >= old).sort((a, b) => a.t - b.t);
      rest.slice(0, Math.ceil(rest.length * fraction)).forEach((i) => localStorage.removeItem(i.k));
    }
  } catch {
    /* ignore */
  }
}

export function clearCache() {
  try {
    cacheKeys().forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function cacheInfo(): { entries: number; kb: number } {
  try {
    const keys = cacheKeys();
    const size = keys.reduce((s, k) => s + (localStorage.getItem(k)?.length ?? 0), 0);
    return { entries: keys.length, kb: Math.round(size / 1024) };
  } catch {
    return { entries: 0, kb: 0 };
  }
}

export interface Quota {
  date: string;
  used: number;
  remaining?: number;
  limit?: number;
}

export function getQuota(): Quota {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const q = JSON.parse(localStorage.getItem(QUOTA_KEY) ?? 'null') as Quota | null;
    if (q && q.date === today) return q;
  } catch {
    /* ignore */
  }
  return { date: today, used: 0 };
}

export function countRequest(remaining?: number, limit?: number) {
  const q = getQuota();
  q.used += 1;
  if (remaining !== undefined && Number.isFinite(remaining)) q.remaining = remaining;
  if (limit !== undefined && Number.isFinite(limit)) q.limit = limit;
  try {
    localStorage.setItem(QUOTA_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

/** Exécute fn si la valeur n'est pas en cache ; évite les doubles appels simultanés. */
const inflight = new Map<string, Promise<unknown>>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key, ttlMs);
  if (hit !== undefined) return hit;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((v) => {
      cacheSet(key, v);
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const MIN = 60000;
export const HOUR = 60 * MIN;
