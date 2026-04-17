import type { PlanName } from './planLimits.js';

const esc = (s: string) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const logoUrl = 'https://www.neurostudy.com.br/logo.png';
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
          <td valign="middle" style="font-size:15px; font-weight:700; color:${brandIndigo};">NeuroStudy</td>
        </tr>
      </table>

      <div style="background:#ffffff; border-radius:16px; padding:28px 24px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        ${content}
      </div>

      <div style="margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px;">
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
        <p style="margin:12px 0 0; font-size:11px; color:#94a3b8;">Você recebe este email porque possui uma conta NeuroStudy. Em caso de dúvidas, responda este email.</p>
      </div>

    </div>
  </div>`;
}

function ctaButton(url: string, label: string) {
  return `
  <table cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="border-radius:10px; background:${brandIndigo};">
        <a href="${esc(url)}" style="display:inline-block; text-decoration:none; color:#ffffff; padding:11px 18px; font-weight:700; font-size:14px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// Email 1: enviado no cadastro (usuário free, sem menção de plano)
export function buildSignupWelcomeEmail(params: { name?: string | null; manageUrl?: string }) {
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';
  const subject = `Bem-vindo ao NeuroStudy! 🧠`;

  const content = `
    <h2 style="margin:0 0 12px; font-size:22px; line-height:1.25; color:${brandIndigo};">Sua conta foi criada! 🎉</h2>

    <p style="margin:0 0 12px; font-size:15px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>

    <p style="margin:0 0 16px; font-size:14px; color:#334155;">Bem-vindo(a) ao NeuroStudy — sua plataforma de estudos com inteligência artificial. Sua conta já está pronta para usar.</p>

    <div style="margin:0 0 20px; padding:16px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
      <p style="margin:0 0 4px; font-size:13px; font-weight:700; color:#475569;">Com o plano gratuito você já pode:</p>
      <ul style="margin:8px 0 12px; padding-left:18px; font-size:14px; color:#334155; line-height:1.8;">
        <li>Criar roteiros de estudo com IA</li>
        <li>Gerar quizzes, flashcards e mapas mentais</li>
        <li>Usar fontes como PDF, YouTube e artigos</li>
      </ul>
      ${ctaButton(manageUrl, 'Começar a estudar →')}
    </div>

    <p style="margin:0; font-size:14px; color:#334155;">Qualquer dúvida, é só responder este email. Bons estudos!</p>
  `;

  const htmlBody = emailWrapper(content);
  const textBody = `Bem-vindo ao NeuroStudy${params.name ? `, ${params.name}` : ''}!\n\nSua conta foi criada. Acesse agora: ${manageUrl}\n\nBons estudos!\n\n— Bruno · NeuroStudy\ncontato@neurostudy.com.br`;

  return { subject, htmlBody, textBody };
}

// Email 2: enviado quando o usuário assina um plano pago
export function buildPlanUpgradeEmail(params: { name?: string | null; planName: PlanName; manageUrl?: string }) {
  const planLabel = params.planName === 'pro' ? 'Pro' : params.planName === 'starter' ? 'Starter' : 'Free';
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';
  const subject = `Seu plano foi atualizado para ${planLabel} 🚀`;

  const content = `
    <h2 style="margin:0 0 12px; font-size:22px; line-height:1.25; color:${brandIndigo};">Plano atualizado para ${esc(planLabel)}! ✅</h2>

    <p style="margin:0 0 12px; font-size:15px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>

    <p style="margin:0 0 16px; font-size:14px; color:#334155;">Seu pagamento foi confirmado e seu plano <strong>${esc(planLabel)}</strong> já está ativo. Você agora tem acesso completo a todos os recursos do plano.</p>

    <div style="margin:0 0 20px; padding:16px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
      <p style="margin:0 0 12px; font-size:14px; color:#475569;">Acesse a plataforma e aproveite seu novo plano:</p>
      ${ctaButton(manageUrl, 'Acessar o NeuroStudy →')}
      <p style="margin:10px 0 0; font-size:12px; color:#94a3b8;">Em Configurações → Conta/Plano você vê próxima cobrança, troca de plano e cancelamento.</p>
    </div>

    <p style="margin:0 0 8px; font-size:14px; color:#334155;">Qualquer dúvida, é só responder este email.</p>
    <p style="margin:16px 0 0; font-size:12px; color:#94a3b8;">Se você não reconhece esta assinatura, responda este email e peça o cancelamento imediato.</p>
  `;

  const htmlBody = emailWrapper(content);
  const textBody = `Plano atualizado para ${planLabel}!\n\nOlá${params.name ? `, ${params.name}` : ''}! Seu pagamento foi confirmado e o plano ${planLabel} já está ativo.\n\nAcesse: ${manageUrl}\n\nDúvidas? Responda este email.\n\n— Bruno · NeuroStudy\ncontato@neurostudy.com.br`;

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
      ${ctaButton(manageUrl, 'Reasinar NeuroStudy →')}
    </div>

    <p style="margin:0; font-size:14px; color:#334155;">Se o cancelamento foi um engano ou tiver dúvidas, responda este email.</p>
  `;

  const htmlBody = emailWrapper(content);
  const textBody = `Assinatura cancelada.\n\nOlá${params.name ? `, ${params.name}` : ''}! Sua assinatura NeuroStudy ${planLabel} foi cancelada. Plano atual: Free.\n\nQuer voltar? Acesse: ${manageUrl}\n\n— Bruno · NeuroStudy\ncontato@neurostudy.com.br`;

  return { subject, htmlBody, textBody };
}
