import { sendZeptoMail } from './zeptomail.js';
import { buildWelcomeEmail, buildCancelledEmail } from './emailTemplates.js';
import type { PlanName } from './planLimits.js';

export async function sendWelcomeEmail(params: { toEmail: string; name?: string | null; planName: PlanName }) {
  const { subject, htmlBody, textBody } = buildWelcomeEmail({
    name: params.name,
    planName: params.planName,
    manageUrl: 'https://www.neurostudy.com.br'
  });

  return sendZeptoMail({
    to: { address: params.toEmail, name: params.name || undefined },
    subject,
    htmlBody,
    textBody,
  });
}

export async function sendCancelledEmail(params: { toEmail: string; name?: string | null; previousPlanName: PlanName }) {
  const { subject, htmlBody, textBody } = buildCancelledEmail({
    name: params.name,
    planName: params.previousPlanName,
    manageUrl: 'https://www.neurostudy.com.br'
  });

  return sendZeptoMail({
    to: { address: params.toEmail, name: params.name || undefined },
    subject,
    htmlBody,
    textBody,
  });
}
