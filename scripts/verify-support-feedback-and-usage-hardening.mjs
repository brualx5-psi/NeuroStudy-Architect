import fs from 'node:fs';

const supportApi = fs.readFileSync('api/support.ts', 'utf8');
const settings = fs.readFileSync('client/src/components/SettingsModal.tsx', 'utf8');
const supportService = fs.readFileSync('client/src/services/supportService.ts', 'utf8');
const usageStore = fs.readFileSync('api/_lib/usageStore.ts', 'utf8');

const checks = [
  [supportApi, 'SUPPORT_EMAIL', 'API de suporte deve ter e-mail de destino configurável'],
  [supportApi, 'getAuthContext(req)', 'API de suporte deve exigir usuário logado'],
  [supportApi, 'sendZeptoMail', 'API de suporte deve enviar e-mail real'],
  [supportApi, 'replyTo: auth.email', 'E-mail de suporte deve permitir responder ao usuário'],
  [supportApi, 'cleanText(body?.message, 3000)', 'Mensagem de suporte deve ter limite'],
  [supportApi, 'SUPPORT_MIN_INTERVAL_MS', 'API de suporte deve ter rate limit simples'],
  [supportApi, 'Retry-After', 'API de suporte deve informar retry em rate limit'],
  [supportApi, 'supportLastSentAt.set(auth.userId', 'API de suporte deve registrar último envio por usuário'],
  [supportService, "fetch('/api/support'", 'Frontend deve chamar /api/support'],
  [supportService, 'Authorization: `Bearer ${token}`', 'Frontend deve enviar token Supabase'],
  [settings, "{ key: 'support', label: 'Suporte' }", 'Configurações deve ter aba Suporte'],
  [settings, 'Suporte, reclamações e feedback', 'Aba Suporte deve explicar finalidade'],
  [settings, 'Enviar para suporte', 'Aba Suporte deve ter botão de envio'],
  [settings, 'sendSupportFeedback', 'Aba Suporte deve chamar serviço de suporte'],
  [settings, 'window.location.pathname', 'Aba Suporte deve evitar enviar URL completa com possíveis query params'],
  [usageStore, '.maybeSingle()', 'usageStore deve evitar erro de .single() quando usuário não existe'],
  [usageStore, 'getUserPlan fallback to free', 'usageStore deve logar fallback de plano'],
];

const missing = checks.filter(([content, needle]) => !content.includes(needle));
if (missing.length) {
  console.error('Falhas de verificação:');
  for (const [, needle, message] of missing) console.error(`- ${message}: ${needle}`);
  process.exit(1);
}

console.log('OK: suporte por e-mail implementado e usageStore endurecido.');
