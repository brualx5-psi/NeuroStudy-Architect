import type { PlanName } from './planLimits.js';

const esc = (s: string) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const logoUrl = 'https://www.neurostudy.com.br/logo.png';
const brandPurple = '#7C3AED';
const brandIndigo = '#4F46E5';

function emailWrapper(content: string) {
  return `
  <div style="font-family: Arial, sans-serif; line-height:1.55; color:#0f172a; background:#f1f5f9;">
    <div style="max-width:640px; margin:0 auto; padding:24px 16px;">

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr>
          <td width="56" valign="middle">
            <img src="${logoUrl}" width="48" height="48" alt="NeuroStudy" style="display:block; border:0; outline:none;" />
          </td>
          <td valign="middle" style="font-size:15px; font-weight:700; color:#4F46E5;">NeuroStudy</td>
        </tr>
      </table>

      <div style="background:#ffffff; border-radius:16px; padding:28px 24px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        ${content}
      </div>

      <div style="margin-top:24px; padding:0 4px; border-top:1px solid #e2e8f0; padding-top:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle" width="40">
              <img src="${logoUrl}" width="32" height="32" alt="NeuroStudy" style="display:block; border:0; border-radius:6px;" />
            </td>
            <td valign="middle" style="padding-left:10px;">
              <div style="font-size:13px; font-weight:700; color:#1e293b;">Bruno · NeuroStudy</div>
              <div style="font-size:12px; color:#64748b;">contato@neurostudy.com.br · neurostudy.com.br</div>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0; font-size:11px; color:#94a3b8;">Você recebe este email porque possui uma assinatura NeuroStudy. Em caso de dúvidas, responda este email.</p>
      </div>

    </div>
  </div>`;
}

export function buildWelcomeEmail(params: { name?: string | null; planName: PlanName; manageUrl?: string }) {
  const planLabel = params.planName === 'pro' ? 'Pro' : params.planName === 'starter' ? 'Starter' : 'Free';
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';

  const subject = `Bem-vindo ao NeuroStudy ${planLabel} 🎉`;

  const content = `
    <h2 style="margin:0 0 12px; font-size:22px; line-height:1.25; color:${brandIndigo};">Bem-vindo(a)! Sua assinatura está ativa ✅</h2>

    <p style="margin:0 0 12px; font-size:15px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>

    <p style="margin:0 0 16px; font-size:14px; color:#334155;">Sua assinatura do NeuroStudy <strong>${esc(planLabel)}</strong> foi confirmada. Você já tem acesso completo à plataforma.</p>

    <div style="margin:0 0 20px; padding:16px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
      <p style="margin:0 0 12px; font-size:14px; color:#475569;">Acesse sua conta e acompanhe sua assinatura:</p>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-radius:10px; background:${brandIndigo};">
            <a href="${esc(manageUrl)}" style="display:inline-block; text-decoration:none; color:#ffffff; padding:11px 18px; font-weight:700; font-size:14px;">Acessar o NeuroStudy →</a>
          </td>
        </tr>
      </table>
      <p style="margin:10px 0 0; font-size:12px; color:#94a3b8;">Em Configurações → Conta/Plano você vê a próxima cobrança, troca de plano e cancelamento.</p>
    </div>

    <p style="margin:0 0 8px; font-size:14px; color:#334155;">Qualquer dúvida, é só responder este email — estarei aqui para ajudar.</p>

    <p style="margin:16px 0 0; font-size:12px; color:#94a3b8;">Se você não reconhece esta assinatura, responda este email e peça o cancelamento imediato.</p>
  `;

  const htmlBody = emailWrapper(content);

  const textBody = `Bem-vindo(a) ao NeuroStudy ${planLabel}!\n\nSua assinatura foi confirmada. Acesse a plataforma em: ${manageUrl}\n\nEm Configurações → Conta/Plano você encontra próxima cobrança, troca de plano e cancelamento.\n\nDúvidas? Responda este email.\n\n— Bruno · NeuroStudy\ncontato@neurostudy.com.br`;

  return { subject, htmlBody, textBody };
}

export function buildCancelledEmail(params: { name?: string | null; planName: PlanName; manageUrl?: string }) {
  const planLabel = params.planName === 'pro' ? 'Pro' : params.planName === 'starter' ? 'Starter' : 'Free';
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';

  const subject = `Assinatura cancelada — NeuroStudy`;

  const content = `
    <h2 style="margin:0 0 12px; font-size:20px; line-height:1.25; color:#334155;">Assinatura cancelada</h2>

    <p style="margin:0 0 12px; font-size:15px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>

    <p style="margin:0 0 16px; font-size:14px; color:#334155;">Sua assinatura do NeuroStudy <strong>${esc(planLabel)}</strong> foi cancelada. Seu acesso voltou para o plano <strong>Free</strong>.</p>

    <div style="margin:0 0 20px; padding:16px; border:1px solid #fde8e8; border-radius:12px; background:#fff5f5;">
      <p style="margin:0 0 12px; font-size:14px; color:#475569;">Sentiremos sua falta! Se quiser voltar, é só assinar novamente:</p>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-radius:10px; background:${brandIndigo};">
            <a href="${esc(manageUrl)}" style="display:inline-block; text-decoration:none; color:#ffffff; padding:11px 18px; font-weight:700; font-size:14px;">Reasinar NeuroStudy →</a>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px; font-size:14px; color:#334155;">Se o cancelamento foi um engano ou tiver dúvidas, responda este email.</p>
  `;

  const htmlBody = emailWrapper(content);

  const textBody = `Assinatura cancelada.\n\nOlá${params.name ? `, ${params.name}` : ''}! Sua assinatura NeuroStudy ${planLabel} foi cancelada. Seu plano agora está como Free.\n\nQuer voltar? Acesse: ${manageUrl}\n\n— Bruno · NeuroStudy\ncontato@neurostudy.com.br`;

  return { subject, htmlBody, textBody };
}
