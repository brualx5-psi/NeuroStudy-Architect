import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const packageJson = JSON.parse(read('package.json'));
const devDeps = packageJson.devDependencies || {};
const deps = packageJson.dependencies || {};

expect(packageJson.scripts?.lint === 'eslint .', 'package.json deve manter script lint = eslint .');
expect(Boolean(devDeps.eslint), 'eslint deve existir em devDependencies');
expect(exists('eslint.config.js'), 'eslint.config.js deve existir');
expect(exists('.github/workflows/ci.yml'), 'workflow .github/workflows/ci.yml deve existir');

if (exists('.github/workflows/ci.yml')) {
  const ci = read('.github/workflows/ci.yml');
  expect(ci.includes('npm ci'), 'CI deve rodar npm ci');
  expect(ci.includes('npm run lint'), 'CI deve rodar npm run lint');
  expect(ci.includes('npm run build'), 'CI deve rodar npm run build');
  expect(ci.includes('scripts/verify-public-beta-hardening.mjs'), 'CI deve rodar verify-public-beta-hardening');
}

expect(Boolean(deps['@sentry/node']), '@sentry/node deve existir em dependencies');
expect(exists('api/_lib/sentry.ts'), 'api/_lib/sentry.ts deve existir');

if (exists('api/ai.ts')) {
  const ai = read('api/ai.ts');
  expect(ai.includes("setCorsHeaders(req, res, 'POST, OPTIONS')"), 'api/ai.ts deve usar setCorsHeaders');
  expect(!ai.includes("Access-Control-Allow-Origin', '*'"), 'api/ai.ts não deve liberar CORS com *');
  expect(ai.includes('captureApiException'), 'api/ai.ts deve capturar exceções no Sentry');
}

if (exists('api/_lib/cors.ts')) {
  const cors = read('api/_lib/cors.ts');
  expect(cors.includes('CORS_ALLOWED_ORIGINS'), 'cors.ts deve suportar CORS_ALLOWED_ORIGINS');
  expect(cors.includes('neurostudy.com.br'), 'cors.ts deve permitir domínios NeuroStudy por padrão');
  expect(cors.includes('localhost'), 'cors.ts deve permitir localhost em desenvolvimento');
  expect(cors.includes('allowExtensionOrigins'), 'cors.ts deve permitir origem de extensão de forma explícita quando necessário');
}

const apiFiles = [
  'api/admin/overridePlan.ts',
  'api/admin/testEmail.ts',
  'api/extension.ts',
  'api/billing/profile.ts',
  'api/subscription.ts',
  'api/asaas/checkout.ts',
];
for (const file of apiFiles) {
  if (!exists(file)) continue;
  const content = read(file);
  expect(!content.includes("Access-Control-Allow-Origin', '*'"), `${file} não deve liberar CORS com *`);
  expect(content.includes('setCorsHeaders'), `${file} deve usar setCorsHeaders`);
}

if (exists('api/_lib/auth.ts')) {
  const auth = read('api/_lib/auth.ts');
  expect(auth.includes('ENABLE_DEV_AUTH_HEADER'), 'auth.ts deve exigir ENABLE_DEV_AUTH_HEADER para x-dev-user');
  expect(auth.includes("process.env.NODE_ENV !== 'production'"), 'auth.ts deve bloquear x-dev-user em produção');
}

if (exists('.env.example')) {
  const env = read('.env.example');
  const requiredEnvKeys = [
    'PUBLIC_SITE_URL=',
    'SENTRY_DSN=',
    'CORS_ALLOWED_ORIGINS=',
    'SUPABASE_URL=',
    'SUPABASE_ANON_KEY=',
    'SUPABASE_SERVICE_ROLE_KEY=',
    'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=',
    'GOOGLE_CLOUD_PROJECT=',
    'SUPPORT_EMAIL=',
    'ZEPTOMAIL_TOKEN=',
    'ZEPTOMAIL_FROM_EMAIL=',
    'ASAAS_API_KEY=',
    'ASAAS_WEBHOOK_TOKEN=',
    'MERCADOPAGO_ACCESS_TOKEN=',
    'ENABLE_DEV_AUTH_HEADER=',
  ];
  for (const key of requiredEnvKeys) {
    expect(env.includes(key), `.env.example deve documentar ${key}`);
  }
} else {
  failures.push('.env.example deve existir');
}

if (failures.length) {
  console.error('Falhas de hardening beta público:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Hardening beta público verificado.');
