/**
 * Shared CORS helper – replaces blanket Access-Control-Allow-Origin: *
 *
 * Strategy:
 * 1. If CORS_ALLOWED_ORIGINS is set (comma-separated), use it as explicit allowlist.
 * 2. Otherwise allow localhost in dev plus the Vercel production/preview URL when present.
 * 3. If Origin is not allowed, omit Access-Control-Allow-Origin so the browser blocks it.
 */

const buildAllowlist = (): Set<string> => {
  const explicit = process.env.CORS_ALLOWED_ORIGINS;
  if (explicit) {
    return new Set(
      explicit
        .split(',')
        .map((origin) => origin.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  const defaults = [
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionUrl) defaults.push(`https://${productionUrl}`);

  const previewUrl = process.env.VERCEL_URL;
  if (previewUrl) defaults.push(`https://${previewUrl}`);

  return new Set(defaults.map((origin) => origin.toLowerCase()));
};

let cachedAllowlist: Set<string> | null = null;

const getAllowlist = () => {
  if (!cachedAllowlist) cachedAllowlist = buildAllowlist();
  return cachedAllowlist;
};

export function setCorsHeaders(
  req: { headers?: Record<string, string | string[] | undefined> },
  res: { setHeader(name: string, value: string): void },
  methods = 'POST, OPTIONS',
) {
  const rawOrigin = req.headers?.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
  const normalizedOrigin = String(origin || '').toLowerCase();

  if (normalizedOrigin && getAllowlist().has(normalizedOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
