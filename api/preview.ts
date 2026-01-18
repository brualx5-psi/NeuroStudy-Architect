import { getAuthContext } from './_lib/auth.js';
import { getClientIp, readJson, sendJson } from './_lib/http.js';
import { rateLimit } from './_lib/rateLimit.js';

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

export default async function handler(req: any, res: any) {
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
