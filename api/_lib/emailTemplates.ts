import type { PlanName } from './planLimits.js';

const esc = (s: string) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function buildWelcomeEmail(params: { name?: string | null; planName: PlanName; manageUrl?: string }) {
  const planLabel = params.planName === 'pro' ? 'Pro' : params.planName === 'starter' ? 'Starter' : 'Free';
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';

  const subject = `Bem-vindo ao NeuroStudy ${planLabel}`;

  // Logo pequeno (hosteado no próprio site). Mantém simples e compatível com a maioria dos clients.
  const logoUrl = 'https://www.neurostudy.com.br/logo.png';
  const brandPurple = '#7C3AED';
  const brandIndigo = '#4F46E5';

  const htmlBody = `
  <div style="font-family: Arial, sans-serif; line-height:1.55; color:#0f172a; background:#ffffff;">
    <div style="max-width:640px; margin:0 auto; padding:24px 18px;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
        <img src="${logoUrl}" width="48" height="48" alt="NeuroStudy" style="display:block; border:0; outline:none;" />
        <div style="font-size:14px; color:#475569;">NeuroStudy</div>
      </div>

      <h2 style="margin:0 0 10px; font-size:22px; line-height:1.25; color:${brandIndigo};">Bem-vindo(a)! Sua assinatura está ativa ✅</h2>

      <p style="margin:0 0 12px; font-size:14px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>

      <p style="margin:0 0 12px; font-size:14px;">Sua assinatura do NeuroStudy (<strong>${esc(planLabel)}</strong>) foi confirmada.</p>

      <div style="margin:16px 0 18px; padding:14px 14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
        <p style="margin:0 0 10px; font-size:14px;">Você já pode acessar a plataforma e acompanhar sua conta por aqui:</p>
        <a href="${esc(manageUrl)}" style="display:inline-block; text-decoration:none; background:linear-gradient(90deg, ${brandIndigo}, ${brandPurple}); color:#ffffff; padding:10px 14px; border-radius:10px; font-weight:700; font-size:14px;">Abrir Configurações → Conta/Plano</a>
        <p style="margin:10px 0 0; font-size:12px; color:#64748b;">(próxima cobrança, troca de plano e cancelamento)</p>
      </div>

      <p style="margin:0 0 10px; font-size:14px;">Se você tiver qualquer dúvida, é só responder este e-mail.</p>

      <p style="margin:18px 0 0; font-size:12px; color:#64748b;">Se você não reconhece esta assinatura, responda este e-mail e peça cancelamento.</p>
    </div>
  </div>`;

  const textBody = `Bem-vindo(a)! Sua assinatura do NeuroStudy (${planLabel}) está ativa. Para gerenciar (status do plano, próxima cobrança e cancelamento): ${manageUrl} (Configurações → Conta/Plano). Se você não reconhece esta assinatura, responda este e-mail.`;

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
