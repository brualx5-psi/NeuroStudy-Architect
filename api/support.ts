import { getAuthContext } from './_lib/auth.js';
import { setCorsHeaders } from './_lib/cors.js';
import { readJson, sendJson } from './_lib/http.js';
import { sendZeptoMail } from './_lib/zeptomail.js';

const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || 'contato@neurostudy.com.br').trim();
const SUPPORT_MIN_INTERVAL_MS = 60 * 1000;
const supportRateLimitStore = globalThis as typeof globalThis & { __supportLastSentAt?: Map<string, number> };
const supportLastSentAt = supportRateLimitStore.__supportLastSentAt || new Map<string, number>();
supportRateLimitStore.__supportLastSentAt = supportLastSentAt;

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Erro / bug',
  feedback: 'Feedback / sugestão',
  billing: 'Pagamento / plano',
  content: 'Qualidade do estudo',
  other: 'Outro'
};

const cleanText = (value: unknown, maxLength: number) => {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  const auth = await getAuthContext(req);
  if (!auth) return sendJson(res, 401, { error: 'unauthorized', message: 'Faça login para enviar suporte.' });

  const now = Date.now();
  const lastSentAt = supportLastSentAt.get(auth.userId) || 0;
  if (now - lastSentAt < SUPPORT_MIN_INTERVAL_MS) {
    const retryAfter = Math.ceil((SUPPORT_MIN_INTERVAL_MS - (now - lastSentAt)) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return sendJson(res, 429, {
      error: 'rate_limited',
      message: `Aguarde ${retryAfter}s antes de enviar outro contato.`
    });
  }

  try {
    const body = await readJson<any>(req);
    const category = CATEGORY_LABELS[body?.category] ? body.category : 'other';
    const subject = cleanText(body?.subject, 120);
    const message = cleanText(body?.message, 3000);
    const pageUrl = cleanText(body?.pageUrl, 300);
    const userAgent = cleanText(body?.userAgent, 300);

    if (subject.length < 3) {
      return sendJson(res, 400, { error: 'invalid_subject', message: 'Escreva um assunto curto.' });
    }
    if (message.length < 10) {
      return sendJson(res, 400, { error: 'invalid_message', message: 'Descreva um pouco melhor o que aconteceu.' });
    }

    const userEmail = cleanText(auth.email, 160) || 'usuario-sem-email@neurostudy.local';
    const categoryLabel = CATEGORY_LABELS[category];
    const emailSubject = `[NeuroStudy suporte] ${categoryLabel}: ${subject}`;
    const htmlBody = `
      <div style="font-family: Inter, Arial, sans-serif; color:#0f172a; line-height:1.5;">
        <h2 style="margin:0 0 12px;">Novo contato de suporte</h2>
        <p><strong>Categoria:</strong> ${escapeHtml(categoryLabel)}</p>
        <p><strong>Usuário:</strong> ${escapeHtml(userEmail)}</p>
        <p><strong>User ID:</strong> ${escapeHtml(auth.userId)}</p>
        ${pageUrl ? `<p><strong>Página:</strong> ${escapeHtml(pageUrl)}</p>` : ''}
        ${userAgent ? `<p><strong>Navegador:</strong> ${escapeHtml(userAgent)}</p>` : ''}
        <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;" />
        <h3 style="margin:0 0 8px;">${escapeHtml(subject)}</h3>
        <p style="white-space:pre-wrap; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px;">${escapeHtml(message)}</p>
      </div>
    `;
    const textBody = [
      `Categoria: ${categoryLabel}`,
      `Usuário: ${userEmail}`,
      `User ID: ${auth.userId}`,
      pageUrl ? `Página: ${pageUrl}` : '',
      userAgent ? `Navegador: ${userAgent}` : '',
      '',
      subject,
      '',
      message
    ].filter(Boolean).join('\n');

    await sendZeptoMail({
      to: { address: SUPPORT_EMAIL, name: 'Suporte NeuroStudy' },
      subject: emailSubject,
      htmlBody,
      textBody,
      replyTo: auth.email ? { address: auth.email } : undefined
    });

    supportLastSentAt.set(auth.userId, Date.now());
    return sendJson(res, 200, { ok: true });
  } catch (error: any) {
    console.error('[support] failed', error?.message || error);
    return sendJson(res, 500, {
      error: 'support_send_failed',
      message: `Não foi possível enviar agora. Tente novamente em alguns minutos ou escreva para ${SUPPORT_EMAIL}.`
    });
  }
}
