import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
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
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/webhooks
 */

// Mapeamento de plan_id do MP para nomes de plano
const PLAN_ID_MAP: Record<string, string> = {
    '1b3bff62d1f44f70878a89508e94c346': 'starter',  // Starter Mensal
    '854c80057c0e420683c129a07273f7c8': 'starter',  // Starter Anual
    '87f2fd4ff4544ade8568359886acd3aa': 'pro',      // Pro Mensal
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
            console.error('[MP Webhook] Erro ao buscar assinatura:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[MP Webhook] Erro na requisição:', error);
        return null;
    }
}

// Atualizar plano do usuário no Supabase
async function updateUserPlan(email: string, planName: string, subscriptionId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        console.error('[MP Webhook] Supabase não disponível');
        return false;
    }

    try {
        // Buscar usuário pelo email
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('id, email, subscription_status')
            .eq('email', email)
            .single();

        if (findError || !user) {
            console.error('[MP Webhook] Usuário não encontrado:', email, findError);
            return false;
        }

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
            return false;
        }

        console.log(`[MP Webhook] Plano atualizado: ${email} -> ${planName}`);
        return true;
    } catch (error) {
        console.error('[MP Webhook] Erro:', error);
        return false;
    }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    // Apenas POST
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const payload = await readJson<MPWebhookPayload>(req);

        console.log('[MP Webhook] Recebido:', JSON.stringify(payload, null, 2));

        // Verificar se é um evento de assinatura
        if (payload.type !== 'subscription_preapproval') {
            console.log('[MP Webhook] Evento ignorado:', payload.type);
            return sendJson(res, 200, { message: 'Evento ignorado' });
        }

        // Buscar detalhes da assinatura
        const subscription = await getSubscriptionDetails(payload.data.id);

        if (!subscription) {
            console.error('[MP Webhook] Não foi possível buscar detalhes da assinatura');
            return sendJson(res, 200, { message: 'Assinatura não encontrada' });
        }

        console.log('[MP Webhook] Assinatura:', {
            id: subscription.id,
            email: subscription.payer_email,
            status: subscription.status,
            plan_id: subscription.preapproval_plan_id,
        });

        // Determinar o plano baseado no plan_id
        const planName = PLAN_ID_MAP[subscription.preapproval_plan_id];

        if (!planName) {
            console.warn('[MP Webhook] Plan ID não mapeado:', subscription.preapproval_plan_id);
        }

        // Processar baseado no status
        switch (subscription.status) {
            case 'authorized':
                // Assinatura ativa - atualizar para o plano correspondente
                if (planName) {
                    await updateUserPlan(subscription.payer_email, planName, subscription.id);
                }
                break;

            case 'cancelled':
            case 'paused':
                // Assinatura cancelada ou pausada - voltar para free
                await updateUserPlan(subscription.payer_email, 'free', subscription.id);
                break;

            case 'pending':
                // Assinatura pendente - manter status atual (não fazer nada)
                console.log('[MP Webhook] Assinatura pendente, aguardando pagamento');
                break;

            default:
                console.log('[MP Webhook] Status não tratado:', subscription.status);
        }

        return sendJson(res, 200, { message: 'OK' });
    } catch (error) {
        console.error('[MP Webhook] Erro no handler:', error);
        return sendJson(res, 500, { error: 'Internal server error' });
    }
}
