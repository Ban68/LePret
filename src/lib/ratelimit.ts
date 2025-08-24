const WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5;

interface Entry {
  count: number;
  expires: number;
}

const store = new Map<string, Entry>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.expires < now) {
    store.set(ip, { count: 1, expires: now + WINDOW });
    return false;
  }

  if (entry.count >= MAX_REQUESTS) {
    return true;
  }

  entry.count += 1;
  return false;
}
