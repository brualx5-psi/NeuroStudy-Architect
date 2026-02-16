import type { PlanName } from './planLimits.js';

const esc = (s: string) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function buildWelcomeEmail(params: { name?: string | null; planName: PlanName; manageUrl?: string }) {
  const planLabel = params.planName === 'pro' ? 'Pro' : params.planName === 'starter' ? 'Starter' : 'Free';
  const manageUrl = params.manageUrl || 'https://www.neurostudy.com.br';

  const subject = `Bem-vindo ao NeuroStudy ${planLabel}`;

  const htmlBody = `
  <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
    <h2 style="margin:0 0 12px;">Assinatura confirmada ✅</h2>
    <p style="margin:0 0 12px;">Olá${params.name ? `, <strong>${esc(params.name)}</strong>` : ''}!</p>
    <p style="margin:0 0 12px;">Sua assinatura do NeuroStudy (<strong>${esc(planLabel)}</strong>) está ativa.</p>
    <p style="margin:0 0 12px;">Para ver status do plano, próxima cobrança e cancelar quando quiser: <a href="${esc(manageUrl)}">Configurações → Conta/Plano</a>.</p>
    <p style="margin:18px 0 0; font-size:12px; color:#555;">Se você não reconhece esta assinatura, responda este e-mail e peça cancelamento.</p>
  </div>`;

  const textBody = `Assinatura confirmada. Sua assinatura do NeuroStudy (${planLabel}) está ativa. Para gerenciar/cancelar: ${manageUrl} (Configurações → Conta/Plano).`;

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
