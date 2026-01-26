import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
import type { IncomingMessage, ServerResponse } from 'http';

interface CreateCheckoutBody {
    planType: 'starter' | 'pro' | 'starter_anual' | 'pro_anual';
    couponCode?: string;
    userEmail: string;
}

// Map internal plan types to configuration (Base Price, Name)
// Note: We will generate the Mercado Pago Preapproval dynamically.
const PLANS_CONFIG = {
    starter: {
        name: 'NeuroStudy Starter Mensal',
        price: 29.90,
        frequency: 1,
        frequency_type: 'months'
    },
    starter_anual: {
        name: 'NeuroStudy Starter Anual',
        price: 299.90,
        frequency: 12,
        frequency_type: 'months'
    },
    pro: {
        name: 'NeuroStudy Pro Mensal',
        price: 59.90,
        frequency: 1,
        frequency_type: 'months'
    },
    pro_anual: {
        name: 'NeuroStudy Pro Anual',
        price: 599.90,
        frequency: 12,
        frequency_type: 'months'
    }
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const body = await readJson<CreateCheckoutBody>(req);
        const { planType, couponCode, userEmail } = body;

        if (!PLANS_CONFIG[planType]) {
            return sendJson(res, 400, { error: 'Plano inválido' });
        }

        const planConfig = PLANS_CONFIG[planType];
        let finalPrice = planConfig.price;
        let discountApplied = false;

        if (couponCode) {
            const supabase = getSupabaseAdmin();
            if (!supabase) {
                console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
                return sendJson(res, 500, { error: 'Server configuration error' });
            }
            const { data: coupon, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', couponCode.toUpperCase()) // Case insensitive
                .single();

            if (error || !coupon || !coupon.active) {
                return sendJson(res, 400, { error: 'Cupom inválido ou expirado' });
            }

            // Apply Discount
            const discountAmount = planConfig.price * (coupon.discount_percent / 100);
            finalPrice = planConfig.price - discountAmount;
            discountApplied = true;

            // Round to 2 decimal places
            finalPrice = Math.round(finalPrice * 100) / 100;
        }

        // 2. Create Preapproval (Subscription) in Mercado Pago
        // We create a specific preference/plan for this transaction
        const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!mpAccessToken) {
            console.error('MERCADOPAGO_ACCESS_TOKEN not configured');
            return sendJson(res, 500, { error: 'Server configuration error' });
        }

        const payload = {
            reason: discountApplied ? `${planConfig.name} (${couponCode})` : planConfig.name,
            auto_recurring: {
                frequency: planConfig.frequency,
                frequency_type: planConfig.frequency_type,
                transaction_amount: finalPrice,
                currency_id: 'BRL'
            },
            back_url: 'https://neurostudy.app/app', // Adjust to your production URL
            payer_email: userEmail,
            status: 'pending',
            external_reference: JSON.stringify({
                role: planType.includes('pro') ? 'pro' : 'starter',
                original_price: planConfig.price,
                discounted: discountApplied,
                coupon: couponCode,
                plan_type: planType
            })
        };

        const mpResponse = await fetch('https://api.mercadopago.com/preapproval_plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mpAccessToken}`
            },
            body: JSON.stringify(payload)
        });

        const mpData = await mpResponse.json();

        if (!mpResponse.ok) {
            console.error('Mercado Pago Error:', mpData);
            return sendJson(res, 500, { error: 'Erro ao criar assinatura no Mercado Pago' });
        }

        // 3. Return the init_point (checkout link)
        // For 'preapproval_plan', the link is usually in 'init_point'
        return sendJson(res, 200, {
            init_point: mpData.init_point,
            sandbox_init_point: mpData.sandbox_init_point, // If testing
            plan_id: mpData.id,
            price: finalPrice
        });

    } catch (error) {
        console.error('Create Checkout Error:', error);
        return sendJson(res, 500, { error: 'Internal server error' });
    }
}
