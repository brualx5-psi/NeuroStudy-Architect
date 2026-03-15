import type { RequestInit } from 'node-fetch';

function getAsaasBaseUrl() {
  // Defaults to production.
  // Set ASAAS_ENV=sandbox to use sandbox.
  // Or override fully with ASAAS_API_BASE
  const base = (process.env.ASAAS_API_BASE || '').trim();
  if (base) return base.replace(/\/+$/, '');

  const env = (process.env.ASAAS_ENV || 'production').toLowerCase();
  if (env === 'sandbox') return 'https://api-sandbox.asaas.com/v3';
  return 'https://api.asaas.com/v3';
}

function getAsaasApiKey() {
  const key = (process.env.ASAAS_API_KEY || '').trim();
  if (!key) throw new Error('ASAAS_API_KEY_not_configured');
  return key;
}

export async function asaasFetch(path: string, init: RequestInit = {}) {
  const url = `${getAsaasBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  const apiKey = getAsaasApiKey();

  const headers = new Headers(init.headers as any);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  // Asaas uses access_token header
  headers.set('access_token', apiKey);

  const resp = await fetch(url, {
    ...init,
    headers,
  } as any);

  const text = await resp.text().catch(() => '');
  const payload = text ? safeJson(text) : null;

  return { resp, payload, text };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function requireAsaasWebhookToken(headers: Record<string, any>) {
  const expected = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
  if (!expected) throw new Error('ASAAS_WEBHOOK_TOKEN_not_configured');

  const received = String(headers['asaas-access-token'] || headers['Asaas-Access-Token'] || '').trim();
  if (!received || received !== expected) {
    const err: any = new Error('invalid_webhook_token');
    err.statusCode = 401;
    throw err;
  }
}
