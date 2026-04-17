import { sendZeptoMail } from './zeptomail.js';
import { buildSignupWelcomeEmail, buildPlanUpgradeEmail, buildCancelledEmail } from './emailTemplates.js';
import type { PlanName } from './planLimits.js';

const MANAGE_URL = 'https://www.neurostudy.com.br';

export async function sendSignupWelcomeEmail(params: { toEmail: string; name?: string | null }) {
  const { subject, htmlBody, textBody } = buildSignupWelcomeEmail({
    name: params.name,
    manageUrl: MANAGE_URL,
  });
  return sendZeptoMail({
    to: { address: params.toEmail, name: params.name || undefined },
    subject,
    htmlBody,
    textBody,
  });
}

export async function sendPlanUpgradeEmail(params: { toEmail: string; name?: string | null; planName: PlanName }) {
  const { subject, htmlBody, textBody } = buildPlanUpgradeEmail({
    name: params.name,
    planName: params.planName,
    manageUrl: MANAGE_URL,
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
    manageUrl: MANAGE_URL,
  });
  return sendZeptoMail({
    to: { address: params.toEmail, name: params.name || undefined },
    subject,
    htmlBody,
    textBody,
  });
}
