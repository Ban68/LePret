export function isBackofficeAllowed(email?: string | null) {
  const allowed = (process.env.BACKOFFICE_ALLOWED_EMAILS || '')
    .split(/[\,\s]+/)
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  if (!allowed.length) {
    return true;
  }

  return !!email && allowed.includes(email.toLowerCase());
}

