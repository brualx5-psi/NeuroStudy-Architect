const DEFAULT_ALLOWED_ORIGINS = [
  'https://neurostudy.com.br',
  'https://www.neurostudy.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
];

type CorsOptions = {
  allowExtensionOrigins?: boolean;
};

const isAllowedExtensionOrigin = (origin: string) => {
  return origin.startsWith('chrome-extension://') || origin.includes('chromiumapp.org');
};

export const setCorsHeaders = (req: any, res: any, methods = 'GET, POST, OPTIONS', options: CorsOptions = {}) => {
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;

  const origin = req?.headers?.origin;
  if (origin && (allowedOrigins.includes(origin) || (options.allowExtensionOrigins && isAllowedExtensionOrigin(origin)))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};
