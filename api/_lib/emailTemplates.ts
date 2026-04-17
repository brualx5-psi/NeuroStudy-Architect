import type { PlanName } from './planLimits.js';

const esc = (s: string) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function buildWelcomeEmail(params: { name?: string | null; planName: PlanName; manageUrl?: string }) {
  const planLabel = params.planName === 'pro' ? 'Pro' : params.planName === 'starter' ? 'Starter' : 'Free';
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';

  const subject = `Sua assinatura NeuroStudy ${planLabel} foi ativada ✅`;

  // Logo pequeno (hosteado no próprio site). Mantém simples e compatível com a maioria dos clients.
  const logoUrl = 'https://www.neurostudy.com.br/logo.png';
  const brandPurple = '#7C3AED';
  const brandIndigo = '#4F46E5';
  const planHighlight = params.planName === 'pro'
    ? 'Com o plano Pro, você libera a experiência completa para estudar com mais profundidade e flexibilidade.'
    : params.planName === 'starter'
      ? 'Com o plano Starter, você já pode começar com mais velocidade, organização e constância nos estudos.'
      : 'Sua conta está pronta para começar.';

  const htmlBody = `
  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#0f172a; background:#ffffff;">
    <div style="max-width:640px; margin:0 auto; padding:24px 18px;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
        <img src="${logoUrl}" width="48" height="48" alt="NeuroStudy" style="display:block; border:0; outline:none;" />
        <div style="font-size:14px; color:#475569;">NeuroStudy</div>
      </div>

      <h2 style="margin:0 0 10px; font-size:24px; line-height:1.25; color:${brandIndigo};">Tudo certo — sua assinatura está ativa ✅</h2>

      <p style="margin:0 0 12px; font-size:14px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>

      <p style="margin:0 0 12px; font-size:14px;">Sua assinatura do <strong>NeuroStudy ${esc(planLabel)}</strong> foi confirmada com sucesso.</p>

      <div style="margin:16px 0 18px; padding:16px; border:1px solid #e2e8f0; border-radius:14px; background:linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);">
        <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.04em; text-transform:uppercase; color:#6366f1; font-weight:700;">Seu acesso foi liberado</p>
        <p style="margin:0; font-size:14px; color:#334155;">${esc(planHighlight)}</p>
      </div>

      <div style="margin:0 0 18px; padding:16px; border:1px solid #e2e8f0; border-radius:14px; background:#ffffff;">
        <p style="margin:0 0 10px; font-size:15px; font-weight:700; color:#0f172a;">Próximos passos recomendados:</p>
        <ol style="margin:0; padding-left:20px; font-size:14px; color:#334155;">
          <li style="margin:0 0 8px;">Abra a plataforma e faça seu primeiro estudo.</li>
          <li style="margin:0 0 8px;">Escolha uma fonte: PDF, e-book, vídeo, texto ou link.</li>
          <li style="margin:0;">Acompanhe seu plano em Configurações → Conta/Plano.</li>
        </ol>
      </div>

      <div style="margin:16px 0 18px; padding:14px 14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
        <p style="margin:0 0 10px; font-size:14px;">Você já pode acessar a plataforma e gerenciar sua assinatura aqui:</p>
        <a href="${esc(manageUrl)}" style="display:inline-block; text-decoration:none; background:linear-gradient(90deg, ${brandIndigo}, ${brandPurple}); color:#ffffff; padding:10px 14px; border-radius:10px; font-weight:700; font-size:14px;">Abrir NeuroStudy</a>
        <p style="margin:10px 0 0; font-size:12px; color:#64748b;">Status do plano, próxima cobrança, troca de plano e cancelamento.</p>
      </div>

      <p style="margin:0 0 10px; font-size:14px;">Se tiver qualquer dúvida, é só responder este e-mail.</p>

      <p style="margin:18px 0 0; font-size:12px; color:#64748b;">Se você não reconhece esta assinatura, responda este e-mail e peça cancelamento.</p>
    </div>
  </div>`;

  const textBody = `Tudo certo — sua assinatura do NeuroStudy ${planLabel} está ativa. ${planHighlight} Próximos passos: 1) abra a plataforma, 2) envie sua primeira fonte de estudo, 3) acompanhe seu plano em Configurações → Conta/Plano. Acesse: ${manageUrl}. Se você não reconhece esta assinatura, responda este e-mail.`;

  return { subject, htmlBody, textBody };
}

export function buildCancelledEmail(params: { name?: string | null; planName: PlanName; manageUrl?: string }) {
  const planLabel = params.planName === 'pro' ? 'Pro' : params.planName === 'starter' ? 'Starter' : 'Free';
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';

  const subject = `Assinatura cancelada — NeuroStudy`;
  const htmlBody = `
  <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
    <h2 style="margin:0 0 12px;">Assinatura cancelada ✅</h2>
    <p style="margin:0 0 12px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>
    <p style="margin:0 0 12px;">Sua assinatura do NeuroStudy (${esc(planLabel)}) foi cancelada. Seu plano agora está como <strong>Free</strong>.</p>
    <p style="margin:0 0 12px;">Você pode assinar novamente a qualquer momento em: <a href="${esc(manageUrl)}">${esc(manageUrl)}</a></p>
  </div>`;

  const textBody = `Assinatura cancelada. Seu plano agora está Free. Você pode assinar novamente em: ${manageUrl}`;

  return { subject, htmlBody, textBody };
}
