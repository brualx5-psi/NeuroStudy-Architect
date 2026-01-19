/**
 * Extension OAuth - Authorize Endpoint
 * 
 * Inicia o fluxo OAuth para a extensão Chrome
 * GET /api/extension/authorize?redirect_uri=...
 */


export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const redirectUri = req.query.redirect_uri as string;

    if (!redirectUri) {
        return res.status(400).json({ error: 'redirect_uri required' });
    }

    // Validar que é uma extensão Chrome válida
    if (!redirectUri.startsWith('chrome-extension://') && !redirectUri.includes('chromiumapp.org')) {
        return res.status(400).json({ error: 'invalid_redirect_uri' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;

    if (!supabaseUrl) {
        return res.status(500).json({ error: 'supabase_not_configured' });
    }

    // Construir URL de autorização do Supabase
    const authUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authUrl.searchParams.set('provider', 'google');
    authUrl.searchParams.set('redirect_to', `${process.env.VERCEL_URL || 'https://neurostudy.com.br'}/api/extension/callback?extension_redirect=${encodeURIComponent(redirectUri)}`);

    // Redirecionar para o Supabase Auth
    res.redirect(302, authUrl.toString());
}
