/**
 * Utils API - Consolidated Endpoint
 * 
 * Handles utility routes to reduce Vercel function count
 * POST /api/utils { action: 'preview' | 'transcribe' }
 */

import { createSign } from 'node:crypto';
import { getAuthContext } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendJson, readJson, getClientIp } from './_lib/http.js';
import { rateLimit } from './_lib/rateLimit.js';
import { buildLimitResponse } from './_lib/limitResponses.js';
import { canPerformAction } from './_lib/usageLimits.js';
import { transcribeMedia } from './_lib/gemini.js';
import { ensureUsageRow, getCurrentMonth, getUserAccess, incrementUsage, toUsageSnapshot } from './_lib/usageStore.js';
import { setCorsHeaders } from './_lib/cors.js';
import { buildProviderLimitPayload } from './_lib/providerLimits.js';

// ================= PREVIEW TYPES & CONSTANTS =================
type PreviewRequest = {
    input?: string;
    name?: string;
    type?: string;
};

type PreviewResponse = {
    url: string;
    title?: string;
    summary?: string;
    siteName?: string;
    doi?: string;
    source: 'doi' | 'url';
};

const DOI_REGEX = /^10\.\d{4,}\/\S+$/i;
const DOI_EXTRACT_REGEX = /10\.\d{4,}\/\S+/i;
const MAX_TEXT = 200_000;
const MAX_SUMMARY = 600;

// ================= TRANSCRIBE TYPES & CONSTANTS =================
type TranscribeRequest = {
    action: 'start' | 'transcribe';
    mimeType?: string;
    fileSize?: number;
    displayName?: string;
    fileUri?: string;
    fileName?: string;
    durationMinutes?: number;
};

// ================= HANDLER =================
export default async function handler(req: any, res: any) {
    setCorsHeaders(req, res, 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Get action
    const queryAction = req.query?.action;

    if (!queryAction) {
        return sendJson(res, 400, { error: 'action_required' });
    }

    try {
        switch (queryAction) {
            case 'preview':
                return handlePreview(req, res);
            case 'transcribe':
                return handleTranscribe(req, res);
            default:
                return sendJson(res, 400, { error: 'invalid_action' });
        }
    } catch (err: any) {
        console.error('[utils] Error:', err);
        return sendJson(res, 500, { error: err.message });
    }
}

// ================= PREVIEW LOGIC =================
const decodeHtml = (value: string) =>
    value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

const stripTags = (value: string) =>
    value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const truncate = (value: string, max = MAX_SUMMARY) =>
    value.length > max ? `${value.slice(0, max)}...` : value;

const extractMeta = (html: string, key: string) => {
    const patternA = new RegExp(
        `<meta[^>]+(?:property|name)=[\"']${key}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>`,
        'i'
    );
    const matchA = html.match(patternA);
    if (matchA?.[1]) return matchA[1];
    const patternB = new RegExp(
        `<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']${key}[\"'][^>]*>`,
        'i'
    );
    const matchB = html.match(patternB);
    return matchB?.[1] || '';
};

const extractTitle = (html: string) => {
    const ogTitle = extractMeta(html, 'og:title');
    if (ogTitle) return ogTitle;
    const twitterTitle = extractMeta(html, 'twitter:title');
    if (twitterTitle) return twitterTitle;
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return titleMatch?.[1] || '';
};

const extractDescription = (html: string) => {
    const ogDesc = extractMeta(html, 'og:description');
    if (ogDesc) return ogDesc;
    const twitterDesc = extractMeta(html, 'twitter:description');
    if (twitterDesc) return twitterDesc;
    return extractMeta(html, 'description');
};

const extractDoi = (value?: string) => {
    const text = (value || '').trim();
    if (!text) return '';
    if (DOI_REGEX.test(text)) return text;
    const match = text.match(DOI_EXTRACT_REGEX);
    return match?.[0] || '';
};

const normalizeUrl = (value: string) => {
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `https://${value}`;
};

const isPrivateHost = (hostname: string) => {
    const lower = hostname.toLowerCase();
    if (lower === 'localhost' || lower.endsWith('.local')) return true;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(lower)) {
        const [a, b] = lower.split('.').map((part) => Number(part));
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
    }
    return false;
};

const parseTarget = (input?: string, name?: string) => {
    const raw = (input || '').trim();
    const fallback = (name || '').trim();
    const doi = extractDoi(raw) || extractDoi(fallback);
    if (doi) {
        return { source: 'doi' as const, doi, url: `https://doi.org/${doi}` };
    }

    const candidate = raw || fallback;
    if (!candidate) return null;

    const normalized = normalizeUrl(candidate);
    return { source: 'url' as const, url: normalized };
};

const safeFetch = async (url: string, headers?: Record<string, string>) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('invalid_protocol');
    }
    if (isPrivateHost(parsed.hostname)) {
        throw new Error('blocked_host');
    }
    return fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'NeuroStudy-Architect/1.0',
            Accept: 'text/html,application/xhtml+xml',
            ...headers
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
    });
};

const fetchHtmlPreview = async (url: string): Promise<PreviewResponse> => {
    const response = await safeFetch(url);
    const text = await response.text();
    const html = text.slice(0, MAX_TEXT);
    const title = decodeHtml(extractTitle(html)).trim();
    const description = decodeHtml(extractDescription(html)).trim();

    let summary = description;
    if (!summary) {
        const bodyText = stripTags(html);
        summary = bodyText.slice(0, MAX_SUMMARY);
    }

    const siteName = decodeHtml(extractMeta(html, 'og:site_name')).trim();

    return {
        url,
        title: title || undefined,
        summary: summary ? truncate(summary) : undefined,
        siteName: siteName || undefined,
        source: 'url'
    };
};

const fetchDoiPreview = async (doi: string): Promise<PreviewResponse> => {
    const url = `https://doi.org/${doi}`;
    const response = await safeFetch(url, {
        Accept: 'application/vnd.citationstyles.csl+json'
    });

    if (!response.ok) {
        throw new Error('doi_fetch_failed');
    }

    const data = (await response.json()) as {
        title?: string;
        abstract?: string;
        URL?: string;
        'container-title'?: string;
        issued?: { 'date-parts'?: number[][] };
        author?: { given?: string; family?: string }[];
    };

    const title = decodeHtml(data.title || '').trim();
    const abstract = decodeHtml(data.abstract || '').trim();
    const container = Array.isArray(data['container-title'])
        ? data['container-title'].join(', ')
        : (data['container-title'] as string | undefined);
    const datePart = data.issued?.['date-parts']?.[0];
    const year = Array.isArray(datePart) ? String(datePart[0]) : '';
    const author = (data.author || [])
        .map((item) => [item.given, item.family].filter(Boolean).join(' '))
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
    const summaryBase = abstract || [author, container, year].filter(Boolean).join(' • ');

    return {
        url: data.URL || url,
        title: title || undefined,
        summary: summaryBase ? truncate(stripTags(summaryBase)) : undefined,
        siteName: container || undefined,
        doi,
        source: 'doi'
    };
};

async function handlePreview(req: any, res: any) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const auth = await getAuthContext(req);
    if (!auth) {
        return sendJson(res, 401, { error: 'unauthorized' });
    }

    const ip = getClientIp(req);
    const rateKey = `preview:${auth.userId || ip}`;
    const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 30 });
    if (!rate.allowed) {
        return sendJson(res, 429, { error: 'rate_limited' });
    }

    const body = await readJson<PreviewRequest>(req);
    const target = parseTarget(body.input, body.name);
    if (!target?.url) {
        return sendJson(res, 400, { error: 'invalid_input', message: 'URL ou DOI invalido.' });
    }

    try {
        const preview = target.source === 'doi'
            ? await fetchDoiPreview(target.doi)
            : await fetchHtmlPreview(target.url);
        return sendJson(res, 200, preview);
    } catch (error: any) {
        return sendJson(res, 422, {
            error: 'preview_failed',
            message: 'Nao foi possivel carregar o preview do link.'
        });
    }
}

// ================= TRANSCRIBE LOGIC =================
const isVertexMode = () => {
    const raw = (process.env.GOOGLE_GENAI_USE_VERTEXAI || '').toLowerCase().trim();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

type ServiceAccountCredentials = {
    client_email: string;
    private_key: string;
    token_uri?: string;
};

const getServiceAccountCredentials = (): ServiceAccountCredentials => {
    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GCP_SERVICE_ACCOUNT_JSON;
    const rawBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64;

    let parsed: any = null;

    if (rawJson) {
        parsed = JSON.parse(rawJson);
    } else if (rawBase64) {
        const decoded = Buffer.from(rawBase64, 'base64').toString('utf8');
        parsed = JSON.parse(decoded);
    }

    if (!parsed) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON/GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 missing for Vertex upload');
    }

    if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Service account inválida (client_email/private_key ausentes)');
    }

    parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');

    return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token'
    };
};

const toBase64Url = (value: string | Buffer) =>
    Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

let cachedStorageToken: { value: string; expiresAtMs: number } | null = null;

const getStorageAccessToken = async () => {
    const now = Date.now();
    if (cachedStorageToken && cachedStorageToken.expiresAtMs - 60_000 > now) {
        return cachedStorageToken.value;
    }

    const creds = getServiceAccountCredentials();
    const iat = Math.floor(now / 1000);
    const exp = iat + 3600;

    const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claimSet = toBase64Url(
        JSON.stringify({
            iss: creds.client_email,
            scope: 'https://www.googleapis.com/auth/devstorage.read_write',
            aud: creds.token_uri,
            iat,
            exp,
        })
    );

    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claimSet}`);
    signer.end();
    const signature = toBase64Url(signer.sign(creds.private_key));
    const assertion = `${header}.${claimSet}.${signature}`;

    const tokenResponse = await fetch(creds.token_uri!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion
        })
    });

    if (!tokenResponse.ok) {
        const text = await tokenResponse.text().catch(() => '');
        throw new Error(`Falha ao obter token GCS (${tokenResponse.status}): ${text.slice(0, 300)}`);
    }

    const tokenJson = await tokenResponse.json() as { access_token: string; expires_in?: number };
    const accessToken = tokenJson.access_token;
    if (!accessToken) throw new Error('Resposta OAuth sem access_token');

    cachedStorageToken = {
        value: accessToken,
        expiresAtMs: now + ((tokenJson.expires_in || 3600) * 1000)
    };

    return accessToken;
};

const sanitizeFileName = (name: string) =>
    (name || 'upload.bin')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || 'upload.bin';

const createVertexResumableUpload = async ({
    userId,
    displayName,
    mimeType,
}: {
    userId: string;
    displayName: string;
    mimeType: string;
}) => {
    const bucket =
        process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
        process.env.GCS_BUCKET ||
        process.env.GOOGLE_CLOUD_BUCKET;

    if (!bucket) {
        throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET missing for Vertex transcription upload');
    }

    const safeName = sanitizeFileName(displayName || 'upload.bin');
    const objectPath = `transcriptions/${userId}/${Date.now()}-${safeName}`;
    const fileUri = `gs://${bucket}/${objectPath}`;
    const accessToken = await getStorageAccessToken();

    const sessionResponse = await fetch(
        `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=resumable&name=${encodeURIComponent(objectPath)}`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': mimeType || 'application/octet-stream'
            },
            body: JSON.stringify({
                name: objectPath,
                contentType: mimeType || 'application/octet-stream'
            })
        }
    );

    if (!sessionResponse.ok) {
        const text = await sessionResponse.text().catch(() => '');
        throw new Error(`Falha ao criar upload resumable no GCS (${sessionResponse.status}): ${text.slice(0, 300)}`);
    }

    const uploadUrl = sessionResponse.headers.get('location');
    if (!uploadUrl) throw new Error('GCS não retornou URL de upload resumable');

    return {
        uploadUrl,
        fileUri,
        fileName: objectPath,
        provider: 'vertex' as const,
    };
};

async function handleTranscribe(req: any, res: any) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const auth = await getAuthContext(req);
    if (!auth) {
        return sendJson(res, 401, { error: 'unauthorized' });
    }

    const ip = getClientIp(req);
    const rateKey = `youtube:${auth.userId || ip}`;
    const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 10 });
    if (!rate.allowed) {
        return sendJson(res, 429, buildLimitResponse('rate_limited'));
    }

    const body = await readJson<TranscribeRequest>(req);

    const { planName, isAdmin } = await getUserAccess(auth.userId);
    const month = getCurrentMonth();
    const usageRow = await ensureUsageRow(auth.userId, month, planName);
    const usageSnapshot = toUsageSnapshot(usageRow);

    const minutes = body.durationMinutes || 0;
    console.log('[transcribe] Received durationMinutes:', body.durationMinutes, 'Using minutes:', minutes, 'Action:', body.action);
    const check = canPerformAction(planName, usageSnapshot, [], 'youtube', { youtubeMinutes: minutes, isAdmin });
    console.log('[transcribe] canPerformAction result:', check.allowed, 'reason:', check.reason);
    if (!check.allowed) {
        return sendJson(res, 402, buildLimitResponse(check.reason || 'monthly_limit', check.actionSuggestion));
    }

    try {
        if (body.action === 'start') {
            if (!body.mimeType) {
                return sendJson(res, 400, { error: 'missing_mime_type' });
            }

            if (!isVertexMode()) {
                return sendJson(res, 400, {
                    error: 'vertex_mode_required',
                    message: 'Defina GOOGLE_GENAI_USE_VERTEXAI=true para usar transcrição.'
                });
            }

            const upload = await createVertexResumableUpload({
                userId: auth.userId || 'anonymous',
                displayName: body.displayName || 'User Upload',
                mimeType: body.mimeType || 'application/octet-stream'
            });

            return sendJson(res, 200, upload);
        }

        if (body.action === 'transcribe') {
            if (!body.fileUri || !body.mimeType) {
                return sendJson(res, 400, { error: 'missing_file_data' });
            }

            if (!isVertexMode()) {
                return sendJson(res, 400, {
                    error: 'vertex_mode_required',
                    message: 'Defina GOOGLE_GENAI_USE_VERTEXAI=true para usar transcrição.'
                });
            }

            const { transcript, usageTokens } = await transcribeMedia(planName, body.fileUri, body.mimeType);
            const estimatedTokens = transcript ? Math.ceil(transcript.length / 4) : 0;

            await incrementUsage(auth.userId, month, planName, {
                youtube_minutes_used: minutes,
                tokens_estimated: estimatedTokens,
                tokens_used: usageTokens || 0
            });

            return sendJson(res, 200, {
                transcript,
                usage: {
                    estimatedTokens,
                    actualTokens: usageTokens || null
                }
            });
        }

        return sendJson(res, 400, { error: 'invalid_action' });
    } catch (error: any) {
        const providerLimit = buildProviderLimitPayload(error);
        if (providerLimit) {
            return sendJson(res, providerLimit.status, providerLimit.body);
        }
        return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Gemini error' });
    }
}
