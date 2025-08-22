export function isValidOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = new URL(req.url).origin;

  if (origin) {
    try {
      return origin === host;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      return new URL(referer).origin === host;
    } catch {
      return false;
    }
  }

  return false;
}
