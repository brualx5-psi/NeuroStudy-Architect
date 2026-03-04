import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
import { sendWelcomeEmail, sendCancelledEmail } from '../_lib/email.js';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Webhook do Mercado Pago
 * 
 * Recebe notificações de eventos de assinatura e atualiza o plano do usuário.
 * 
 * Eventos tratados:
 * - subscription_preapproval.authorized: Assinatura aprovada/ativada
 * - subscription_preapproval.cancelled: Assinatura cancelada
 * - subscription_preapproval.pending: Assinatura pendente
 * - subscription_preapproval.paused: Assinatura pausada
 * 
 * Estratégia de busca do usuário (em ordem):
 * 1. Por external_reference (user_id do NeuroStudy)
 * 2. Por payer_email
 * 3. Por mp_subscription_id existente
 * 
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/webhooks
 */

// Mapeamento de plan_id do MP para nomes de plano
const PLAN_ID_MAP: Record<string, string> = {
    // Starter
    '1b3bff62d1f44f70878a89508e94c346': 'starter',  // Starter Mensal (antigo)
    'd5db97d0d27a4c11a006800f8ee6e552': 'starter',  // Starter Mensal (atual - link do site)
    '854c80057c0e420683c129a07273f7c8': 'starter',  // Starter Anual

    // Pro
    '87f2fd4ff4544ade8568359886acd3aa': 'pro',      // Pro Mensal (antigo)
    '02935c0c251e465eb1ce329ab2bc98f2': 'pro',      // Pro Mensal (promo/atual - link do site)
    'a7e0f68a4c4f4ddca4c2ae512a8a1db5': 'pro',      // Pro Anual
};

interface MPWebhookPayload {
    action: string;
    api_version: string;
    data: {
        id: string;
    };
    date_created: string;
    id: string;
    live_mode: boolean;
    type: string;
    user_id: string;
}

interface MPSubscriptionDetails {
    id: string;
    payer_id: number;
    payer_email: string;
    back_url: string;
    collector_id: number;
    application_id: number;
    status: 'pending' | 'authorized' | 'paused' | 'cancelled';
    reason: string;
    external_reference: string;
    preapproval_plan_id: string;
    init_point: string;
    auto_recurring: {
        frequency: number;
        frequency_type: string;
        transaction_amount: number;
        currency_id: string;
    };
    date_created: string;
    last_modified: string;
}

// Buscar detalhes da assinatura no Mercado Pago
async function getSubscriptionDetails(subscriptionId: string): Promise<MPSubscriptionDetails | null> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
        console.error('[MP Webhook] MERCADOPAGO_ACCESS_TOKEN não configurado');
        return null;
    }

    try {
        const response = await fetch(
            `https://api.mercadopago.com/preapproval/${subscriptionId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error('[MP Webhook] Erro ao buscar assinatura:', response.status, body);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[MP Webhook] Erro na requisição:', error);
        return null;
    }
}

// Buscar detalhes do pagamento no Mercado Pago (para eventos do tipo 'payment')
async function getPaymentDetails(paymentId: string): Promise<any | null> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) return null;

    try {
        const response = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

type FoundUser = {
    id: string;
    email: string;
    subscription_status: string;
    full_name: string | null;
    method: string;
};

// Busca robusta de usuário: tenta múltiplas estratégias
async function findUser(
    email: string,
    externalReference?: string,
    subscriptionId?: string
): Promise<FoundUser | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        console.error('[MP Webhook] Supabase não disponível');
        return null;
    }

    // Estratégia 1: Por external_reference (user_id do NeuroStudy)
    if (externalReference) {
        const { data } = await supabase
            .from('users')
            .select('id, email, subscription_status, full_name')
            .eq('id', externalReference)
            .single();

        if (data) {
            console.log(`[MP Webhook] ✅ Usuário encontrado por external_reference: ${data.email}`);
            return { ...data, method: 'external_reference' };
        }
        console.log(`[MP Webhook] ⚠️ external_reference '${externalReference}' não encontrado na tabela users`);
    }

    // Estratégia 2: Por email do pagador
    if (email) {
        const { data } = await supabase
            .from('users')
            .select('id, email, subscription_status, full_name')
            .eq('email', email)
            .single();

        if (data) {
            console.log(`[MP Webhook] ✅ Usuário encontrado por email: ${data.email}`);
            return { ...data, method: 'email' };
        }
        console.log(`[MP Webhook] ⚠️ Email '${email}' não encontrado na tabela users`);
    }

    // Estratégia 3: Por mp_subscription_id já registrado
    if (subscriptionId) {
        const { data } = await supabase
            .from('users')
            .select('id, email, subscription_status, full_name')
            .eq('mp_subscription_id', subscriptionId)
            .single();

        if (data) {
            console.log(`[MP Webhook] ✅ Usuário encontrado por mp_subscription_id: ${data.email}`);
            return { ...data, method: 'mp_subscription_id' };
        }
        console.log(`[MP Webhook] ⚠️ mp_subscription_id '${subscriptionId}' não encontrado na tabela users`);
    }

    console.error(`[MP Webhook] ❌ Usuário NÃO encontrado. email=${email}, ref=${externalReference}, subId=${subscriptionId}`);
    return null;
}

// Atualizar plano do usuário no Supabase
async function updateUserPlan(
    userId: string,
    planName: string,
    subscriptionId: string
): Promise<{ ok: boolean; prevPlan?: string; email?: string; fullName?: string | null }> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        console.error('[MP Webhook] Supabase não disponível');
        return { ok: false };
    }

    try {
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('id, email, subscription_status, full_name')
            .eq('id', userId)
            .single();

        if (findError || !user) {
            console.error('[MP Webhook] Usuário não encontrado por ID:', userId, findError);
            return { ok: false };
        }

        const prevPlan = user.subscription_status;

        // Atualizar plano
        const { error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: planName,
                mp_subscription_id: subscriptionId,
                subscription_updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('[MP Webhook] Erro ao atualizar plano:', updateError);
            return { ok: false, prevPlan, email: user.email, fullName: user.full_name };
        }

        console.log(`[MP Webhook] ✅ Plano atualizado: ${user.email} -> ${planName} (era: ${prevPlan})`);
        return { ok: true, prevPlan, email: user.email, fullName: user.full_name };
    } catch (error) {
        console.error('[MP Webhook] Erro:', error);
        return { ok: false };
    }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    // Apenas POST
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const payload = await readJson<MPWebhookPayload>(req);

        console.log('[MP Webhook] ========== EVENTO RECEBIDO ==========');
        console.log('[MP Webhook] Payload:', JSON.stringify(payload, null, 2));

        // Tratar eventos de pagamento (podem conter info da assinatura)
        if (payload.type === 'payment') {
            console.log('[MP Webhook] Evento de pagamento recebido, verificando assinatura vinculada...');
            const payment = await getPaymentDetails(payload.data.id);
            if (payment) {
                console.log('[MP Webhook] Pagamento:', JSON.stringify({
                    id: payment.id,
                    status: payment.status,
                    payer_email: payment.payer?.email,
                    external_reference: payment.external_reference,
                    metadata: payment.metadata,
                }, null, 2));
            }
            // Pagamentos são tratados via subscription_preapproval, apenas logamos
            return sendJson(res, 200, { message: 'Pagamento logado' });
        }

        // Verificar se é um evento de assinatura
        if (payload.type !== 'subscription_preapproval') {
            console.log('[MP Webhook] Evento ignorado:', payload.type);
            return sendJson(res, 200, { message: 'Evento ignorado' });
        }

        // Buscar detalhes da assinatura
        const subscription = await getSubscriptionDetails(payload.data.id);

        if (!subscription) {
            console.error('[MP Webhook] ❌ Não foi possível buscar detalhes da assinatura:', payload.data.id);
            return sendJson(res, 200, { message: 'Assinatura não encontrada' });
        }

        console.log('[MP Webhook] Detalhes da assinatura:', JSON.stringify({
            id: subscription.id,
            email: subscription.payer_email,
            status: subscription.status,
            plan_id: subscription.preapproval_plan_id,
            external_reference: subscription.external_reference,
            amount: subscription.auto_recurring?.transaction_amount,
        }, null, 2));

        // Determinar o plano baseado no plan_id
        const planName = PLAN_ID_MAP[subscription.preapproval_plan_id];

        if (!planName) {
            console.error(`[MP Webhook] ❌ Plan ID NÃO MAPEADO: '${subscription.preapproval_plan_id}' — PRECISA ADICIONAR ao PLAN_ID_MAP!`);
        }

        // Buscar usuário com estratégias múltiplas
        const user = await findUser(
            subscription.payer_email,
            subscription.external_reference,
            subscription.id
        );

        // Processar baseado no status
        switch (subscription.status) {
            case 'authorized':
                // Assinatura ativa - atualizar para o plano correspondente
                if (!planName) {
                    console.error('[MP Webhook] ❌ Não é possível ativar sem plan_id mapeado');
                    break;
                }

                if (!user) {
                    console.error(`[MP Webhook] ❌ FALHA CRÍTICA: Assinatura autorizada mas usuário não encontrado! email=${subscription.payer_email}, ref=${subscription.external_reference}`);
                    break;
                }

                {
                    const result = await updateUserPlan(user.id, planName, subscription.id);
                    // Enviar boas-vindas apenas se houve mudança real de plano
                    if (result.ok && result.prevPlan !== planName) {
                        try {
                            await sendWelcomeEmail({
                                toEmail: result.email || subscription.payer_email,
                                name: result.fullName,
                                planName: planName as any
                            });
                            console.log(`[MP Webhook] ✅ Email de boas-vindas enviado para ${result.email}`);
                        } catch (e) {
                            console.error('[MP Webhook] Falha ao enviar boas-vindas (ignorado):', e);
                        }
                    }
                }
                break;

            case 'cancelled':
            case 'paused':
                // Assinatura cancelada ou pausada - voltar para free
                if (!user) {
                    console.log(`[MP Webhook] Cancelamento/pausa mas usuário não encontrado (pode já estar free): ${subscription.payer_email}`);
                    break;
                }

                {
                    const result = await updateUserPlan(user.id, 'free', subscription.id);
                    if (result.ok && result.prevPlan && result.prevPlan !== 'free') {
                        try {
                            await sendCancelledEmail({
                                toEmail: result.email || subscription.payer_email,
                                name: result.fullName,
                                previousPlanName: result.prevPlan as any
                            });
                        } catch (e) {
                            console.error('[MP Webhook] Falha ao enviar cancelamento (ignorado):', e);
                        }
                    }
                }
                break;

            case 'pending':
                // Assinatura pendente - manter status atual (não fazer nada)
                console.log('[MP Webhook] Assinatura pendente, aguardando pagamento');
                break;

            default:
                console.log('[MP Webhook] Status não tratado:', subscription.status);
        }

        console.log('[MP Webhook] ========== FIM DO PROCESSAMENTO ==========');
        return sendJson(res, 200, { message: 'OK' });
    } catch (error) {
        console.error('[MP Webhook] ❌ Erro no handler:', error);
        return sendJson(res, 500, { error: 'Internal server error' });
    }
}
