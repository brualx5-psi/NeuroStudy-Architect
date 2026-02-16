/**
 * ZeptoMail (Zoho) - minimal transactional email helper.
 *
 * Env:
 * - ZEPTOMAIL_TOKEN (required)
 * - ZEPTOMAIL_FROM_EMAIL (required)
 * - ZEPTOMAIL_FROM_NAME (optional)
 */

type ZeptoAddress = { address: string; name?: string };

type SendEmailParams = {
  to: ZeptoAddress;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: ZeptoAddress;
};

const getEnv = (key: string) => (process.env[key] || '').trim();

export async function sendZeptoMail(params: SendEmailParams) {
  const token = getEnv('ZEPTOMAIL_TOKEN');
  const fromEmail = getEnv('ZEPTOMAIL_FROM_EMAIL');
  const fromName = getEnv('ZEPTOMAIL_FROM_NAME') || 'NeuroStudy';

  if (!token) throw new Error('ZEPTOMAIL_TOKEN_not_configured');
  if (!fromEmail) throw new Error('ZEPTOMAIL_FROM_EMAIL_not_configured');

  const payload: any = {
    from: { address: fromEmail, name: fromName },
    to: [{ email_address: params.to }],
    subject: params.subject,
    htmlbody: params.htmlBody,
  };

  if (params.textBody) payload.textbody = params.textBody;
  if (params.replyTo) payload.reply_to = params.replyTo;

  const resp = await fetch('https://api.zeptomail.com/v1.1/email', {
    method: 'POST',
    headers: {
      Authorization: `Zoho-enczapikey ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text().catch(() => '');
  if (!resp.ok) {
    console.error('[zeptomail] send failed', resp.status, text.slice(0, 500));
    throw new Error('zeptomail_send_failed');
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: true };
  }
}
