/**
 * sourceResolver.ts
 * 
 * Responsável por:
 * 1. Detectar tipo de fonte (youtube, upload, link)
 * 2. Resolver transcrição de links públicos (.vtt/.srt/.txt)
 * 3. Normalizar fontes antes de gerar roteiro
 * 4. Bloquear links que exigem login/paywall
 */

import { PLAN_LIMITS, PlanName } from './planLimits.js';
import { estimateTextFromBinary, extractTextFromPdfBase64 } from './textExtraction.js';

// IDs de admin que podem usar qualquer link sem restrição de tipo
// ATENÇÃO: Apenas para ambiente de desenvolvimento ou usuários específicos
const ADMIN_USER_IDS = ['9e067f66-6452-48f5-a85a-3bfa8b8aa500', 'ac8ee945-5443-416e-b9fe-d0266915e44d'];

/**
 * Verifica se o usuário é admin (pode usar qualquer link)
 */
export const isAdminUser = (userId?: string, isAdmin?: boolean): boolean => {
    if (isAdmin) return true;
    if (!userId) return false;
    return ADMIN_USER_IDS.includes(userId);
};

// Tipos de fonte suportados
export type SourceType = 'youtube' | 'video_upload' | 'link_transcript' | 'text' | 'pdf' | 'unsupported_link' | 'web_article';

// Códigos de erro para frontend
export type SourceErrorCode =
    | 'UNSUPPORTED_LINK_REQUIRES_TRANSCRIPT'
    | 'VIDEO_TOO_LONG'
    | 'ROADMAP_TOO_LARGE'
    | 'TOO_MANY_SOURCES'
    | 'MONTHLY_LIMIT'
    | 'FETCH_FAILED';

// Fonte normalizada
export type NormalizedSource = {
    id: string;
    originalType: string;
    resolvedType: SourceType;
    name: string;
    extractedText: string;
    charCount: number;
    durationMinutes?: number;
    isPrimary?: boolean;
    error?: SourceErrorCode;
    errorMessage?: string;
};

// Resultado da preparação
export type PrepareSourcesResult = {
    success: boolean;
    sources?: NormalizedSource[];
    totalCharCount?: number;
    totalDurationMinutes?: number;
    estimatedTokens?: number;
    error?: SourceErrorCode;
    errorMessage?: string;
    actionSuggestion?: 'split_roadmap' | 'remove_sources' | 'view_plans' | 'upload_file' | 'paste_transcript';
};

// URLs de transcrição suportadas (públicas)
const TRANSCRIPT_EXTENSIONS = ['.vtt', '.srt', '.txt', '.sub', '.sbv'];
const TRANSCRIPT_CONTENT_TYPES = ['text/vtt', 'text/plain', 'application/x-subrip', 'text/srt'];

// Domínios bloqueados para plano Free (exigem assinatura/login)
const BLOCKED_PAID_DOMAINS = [
    'udemy.com',
    'coursera.org',
    'edx.org',
    'linkedin.com/learning',
    'skillshare.com',
    'alura.com.br',
    'hotmart.com'
];

const MAX_PDF_CHARS = 200_000;

/**
 * Extrai ID do YouTube de formatos comuns, inclusive quando `v` não é o primeiro parâmetro.
 */
export const extractYouTubeVideoId = (url: string): string | null => {
    const raw = (url || '').trim();
    if (!raw) return null;

    try {
        const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
        if (host.endsWith('youtube.com')) {
            if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
            const match = parsed.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/i);
            if (match?.[1]) return match[1];
        }
    } catch {
        // cai para regex abaixo
    }

    const match = raw.match(/(?:youtube\.com\/(?:watch\?[^\s#]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/i);
    return match?.[1] || null;
};

/**
 * Verifica se URL é do YouTube
 */
export const isYouTubeUrl = (url: string): boolean => Boolean(extractYouTubeVideoId(url));

type YouTubeCaptionTrack = {
    baseUrl?: string;
    languageCode?: string;
    kind?: string;
    name?: { simpleText?: string; runs?: Array<{ text?: string }> };
};

const YOUTUBE_TRANSCRIPT_LANG_PRIORITY = ['pt-BR', 'pt', 'en'];

const decodeHtmlEntities = (value: string): string => value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

const extractBalancedJson = (text: string, startIndex: number): string | null => {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
        } else if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) return text.slice(startIndex, i + 1);
        }
    }
    return null;
};

export const extractCaptionTracksFromHtml = (html: string): YouTubeCaptionTrack[] => {
    const marker = 'ytInitialPlayerResponse';
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) return [];

    const jsonStart = html.indexOf('{', markerIndex);
    if (jsonStart === -1) return [];

    const rawJson = extractBalancedJson(html, jsonStart);
    if (!rawJson) return [];

    try {
        const playerResponse = JSON.parse(rawJson);
        return playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    } catch {
        return [];
    }
};

export const parseYouTubeTranscriptXml = (xml: string): string => {
    const chunks: string[] = [];
    const textRegex = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
    let match: RegExpExecArray | null;

    while ((match = textRegex.exec(xml)) !== null) {
        const cleaned = decodeHtmlEntities(match[1])
            .replace(/\s+/g, ' ')
            .trim();
        if (cleaned) chunks.push(cleaned);
    }

    return chunks.join('\n').trim();
};

const chooseCaptionTrack = (tracks: YouTubeCaptionTrack[]): YouTubeCaptionTrack | null => {
    if (!tracks.length) return null;
    const score = (track: YouTubeCaptionTrack) => {
        const lang = (track.languageCode || '').toLowerCase();
        const priority = YOUTUBE_TRANSCRIPT_LANG_PRIORITY.findIndex(preferred => lang === preferred.toLowerCase() || lang.startsWith(preferred.toLowerCase()));
        const languageScore = priority === -1 ? 100 : priority;
        const autoGeneratedPenalty = track.kind === 'asr' ? 10 : 0;
        return languageScore + autoGeneratedPenalty;
    };
    return [...tracks].sort((a, b) => score(a) - score(b))[0] || null;
};

export const fetchYouTubeTranscript = async (url: string): Promise<{ text: string; error?: string } | null> => {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return { text: '', error: 'Invalid YouTube URL' };

    try {
        const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=pt&persist_hl=1`;
        const response = await fetch(watchUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 NeuroStudy-Architect/1.0',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            },
            signal: AbortSignal.timeout(12000)
        });

        if (!response.ok) return { text: '', error: `YouTube HTTP ${response.status}` };

        const html = await response.text();
        const track = chooseCaptionTrack(extractCaptionTracksFromHtml(html));
        if (!track?.baseUrl) return { text: '', error: 'No captions available' };

        const transcriptResponse = await fetch(`${track.baseUrl}${track.baseUrl.includes('?') ? '&' : '?'}fmt=srv3`, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 NeuroStudy-Architect/1.0' },
            signal: AbortSignal.timeout(12000)
        });

        if (!transcriptResponse.ok) return { text: '', error: `Transcript HTTP ${transcriptResponse.status}` };

        const transcriptXml = await transcriptResponse.text();
        const text = parseYouTubeTranscriptXml(transcriptXml);
        return text ? { text } : { text: '', error: 'Empty transcript' };
    } catch (error: any) {
        return { text: '', error: error?.message || 'YouTube transcript fetch failed' };
    }
};

/**
 * Verifica se URL parece ser uma transcrição pública (.vtt/.srt/.txt)
 */
export const isTranscriptUrl = (url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return TRANSCRIPT_EXTENSIONS.some(ext => lowerUrl.endsWith(ext));
};

/**
 * Detecta o tipo de fonte baseado no conteúdo
 */
export const detectSourceType = (source: any): SourceType => {
    const type = (source.type || '').toUpperCase();
    const content = source.content || source.textContent || '';

    // YouTube
    if (type === 'VIDEO' || type === 'YOUTUBE') {
        if (typeof content === 'string' && isYouTubeUrl(content)) {
            return 'youtube';
        }
        return 'video_upload';
    }

    // URL/Link
    if (type === 'URL' || type === 'LINK') {
        if (typeof content === 'string') {
            if (isYouTubeUrl(content)) return 'youtube';
            if (isTranscriptUrl(content)) return 'link_transcript';
            return 'web_article';
        }
        return 'web_article';
    }

    // PDF
    if (type === 'PDF') return 'pdf';

    // Texto padrão
    return 'text';
};

/**
 * Tenta baixar transcrição de URL pública
 * Retorna texto extraído ou null se falhar
 */
export const fetchTranscriptFromUrl = async (url: string): Promise<{ text: string; error?: string } | null> => {
    try {
        // Limite de tamanho: 500KB para transcrições
        const MAX_SIZE = 500 * 1024;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'NeuroStudy-Architect/1.0',
                'Accept': 'text/plain, text/vtt, application/x-subrip, */*'
            },
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            return { text: '', error: `HTTP ${response.status}` };
        }

        const contentType = response.headers.get('content-type') || '';
        const isTextContent = TRANSCRIPT_CONTENT_TYPES.some(ct => contentType.includes(ct)) ||
            contentType.includes('text/') ||
            isTranscriptUrl(url);

        if (!isTextContent) {
            return { text: '', error: 'Not a text/transcript file' };
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_SIZE) {
            return { text: '', error: 'File too large' };
        }

        const text = await response.text();

        // Parse VTT/SRT para remover timestamps
        const cleanedText = parseSubtitleToText(text);

        return { text: cleanedText };
    } catch (error: any) {
        return { text: '', error: error?.message || 'Fetch failed' };
    }
};

/**
 * Remove timestamps e formatação de arquivos VTT/SRT
 */
const parseSubtitleToText = (content: string): string => {
    // Remove cabeçalho WEBVTT
    let text = content.replace(/^WEBVTT[\s\S]*?\n\n/, '');

    // Remove timestamps VTT/SRT (00:00:00.000 --> 00:00:00.000)
    text = text.replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, '');

    // Remove números de linha SRT
    text = text.replace(/^\d+\s*$/gm, '');

    // Remove tags HTML/VTT
    text = text.replace(/<[^>]+>/g, '');

    // Remove linhas vazias duplicadas
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
};

/**
 * Prepara e normaliza todas as fontes para geração de roteiro
 * Aplica validações de limites ANTES de chamar a IA
 * Admin users podem usar qualquer link sem restrição de tipo
 */
export const prepareSourcesForRoadmap = async (
    sources: any[],
    planName: PlanName,
    usage: { youtube_minutes_used: number; roadmaps_created: number; monthly_tokens_used: number },
    userId?: string,
    isAdmin?: boolean
): Promise<PrepareSourcesResult> => {
    const limits = PLAN_LIMITS[planName];
    const adminBypass = isAdminUser(userId, isAdmin);

    // ADMIN: Pula TODAS as validações de limites (roteiros, fontes, tokens, minutos)
    if (!adminBypass) {
        // Validação 1: número de fontes
        if (sources.length > limits.sources_per_study) {
            return {
                success: false,
                error: 'TOO_MANY_SOURCES',
                errorMessage: `Máximo de ${limits.sources_per_study} fontes por roteiro.`,
                actionSuggestion: 'remove_sources'
            };
        }

        // Validação 2: limite mensal de roteiros
        if (usage.roadmaps_created >= limits.roadmaps) {
            return {
                success: false,
                error: 'MONTHLY_LIMIT',
                errorMessage: 'Limite mensal de roteiros atingido.',
                actionSuggestion: 'view_plans'
            };
        }
    }

    const normalizedSources: NormalizedSource[] = [];
    let totalCharCount = 0;
    let totalDurationMinutes = 0;

    for (const source of sources) {
        const sourceType = detectSourceType(source);
        const sourceId = source.id || `src-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const content = source.content || source.textContent || '';

        // Validação de links pagos para Plano Free (admin pula)
        if (!adminBypass && planName === 'free' && typeof content === 'string') {
            const isBlocked = BLOCKED_PAID_DOMAINS.some(domain => content.toLowerCase().includes(domain));
            if (isBlocked) {
                return {
                    success: false,
                    error: 'UNSUPPORTED_LINK_REQUIRES_TRANSCRIPT',
                    errorMessage: 'Links de plataformas pagas (Udemy, Coursera, etc.) exigem transcrição manual no plano Free.',
                    actionSuggestion: 'paste_transcript'
                };
            }
        }

        // YouTube - validar duração (admin pula validação)
        if (sourceType === 'youtube') {
            const durationMinutes = source.durationMinutes || 0;
            const url = source.content || source.textContent || '';

            if (!adminBypass) {
                if (durationMinutes > limits.youtube_minutes_per_video) {
                    return {
                        success: false,
                        error: 'VIDEO_TOO_LONG',
                        errorMessage: `Vídeo muito longo (${durationMinutes} min). Máximo: ${limits.youtube_minutes_per_video} min.`,
                        actionSuggestion: 'split_roadmap'
                    };
                }

                if (usage.youtube_minutes_used + durationMinutes + totalDurationMinutes > limits.youtube_minutes) {
                    return {
                        success: false,
                        error: 'MONTHLY_LIMIT',
                        errorMessage: 'Limite mensal de minutos de vídeo atingido.',
                        actionSuggestion: 'view_plans'
                    };
                }
            }

            totalDurationMinutes += durationMinutes;

            const providedText = typeof source.textContent === 'string' && !isYouTubeUrl(source.textContent)
                ? source.textContent.trim()
                : '';
            const transcript: { text: string; error?: string } | null = providedText
                ? { text: providedText }
                : await fetchYouTubeTranscript(url);

            if (!transcript?.text?.trim()) {
                return {
                    success: false,
                    error: 'FETCH_FAILED',
                    errorMessage: `Não consegui obter uma legenda/transcrição acessível do YouTube (${transcript?.error || 'sem legenda disponível'}).`,
                    actionSuggestion: 'paste_transcript'
                };
            }

            normalizedSources.push({
                id: sourceId,
                originalType: source.type || 'URL',
                resolvedType: 'youtube',
                name: source.name || `YouTube: ${url.slice(0, 30)}...`,
                extractedText: transcript.text,
                charCount: transcript.text.length,
                durationMinutes,
                isPrimary: Boolean(source.isPrimary)
            });

            totalCharCount += transcript.text.length;
            continue;
        }

        // Upload de vídeo - validar duração (admin pula validação)
        if (sourceType === 'video_upload') {
            const durationMinutes = source.durationMinutes || 0;

            if (!adminBypass && durationMinutes > limits.youtube_minutes_per_video) {
                return {
                    success: false,
                    error: 'VIDEO_TOO_LONG',
                    errorMessage: `Vídeo muito longo (${durationMinutes} min). Máximo: ${limits.youtube_minutes_per_video} min.`,
                    actionSuggestion: 'split_roadmap'
                };
            }

            totalDurationMinutes += durationMinutes;

            const transcript = typeof source.textContent === 'string' ? source.textContent.trim() : '';
            if (!transcript) {
                return {
                    success: false,
                    error: 'UNSUPPORTED_LINK_REQUIRES_TRANSCRIPT',
                    errorMessage: 'Upload de vídeo precisa passar pela transcrição antes de gerar roteiro. Envie o vídeo pelo fluxo de transcrição ou cole a transcrição manualmente.',
                    actionSuggestion: 'paste_transcript'
                };
            }

            normalizedSources.push({
                id: sourceId,
                originalType: source.type || 'VIDEO',
                resolvedType: 'video_upload',
                name: source.name || 'Vídeo transcrito',
                extractedText: transcript,
                charCount: transcript.length,
                durationMinutes,
                isPrimary: Boolean(source.isPrimary)
            });

            totalCharCount += transcript.length;
            continue;
        }

        // Link de transcrição - tentar baixar
        if (sourceType === 'link_transcript') {
            const url = source.content || source.textContent || '';
            const result = await fetchTranscriptFromUrl(url);

            if (!result || !result.text) {
                return {
                    success: false,
                    error: 'FETCH_FAILED',
                    errorMessage: `Não foi possível baixar a transcrição: ${result?.error || 'erro desconhecido'}`,
                    actionSuggestion: 'paste_transcript'
                };
            }

            normalizedSources.push({
                id: sourceId,
                originalType: source.type || 'URL',
                resolvedType: 'link_transcript',
                name: source.name || `Transcrição: ${url.slice(0, 30)}...`,
                extractedText: result.text,
                charCount: result.text.length,
                isPrimary: Boolean(source.isPrimary)
            });

            totalCharCount += result.text.length;
            continue;
        }

        // Web Article - tentar baixar conteúdo
        if (sourceType === 'web_article') {
            const url = source.content || source.textContent || '';
            const result = await fetchTranscriptFromUrl(url);

            // Se falhar o download, usar a URL como texto (fallback) ou retornar erro?
            const textContent = result?.text || url;

            normalizedSources.push({
                id: sourceId,
                originalType: source.type || 'URL',
                resolvedType: 'web_article',
                name: source.name || `Site: ${url.slice(0, 30)}...`,
                extractedText: textContent,
                charCount: textContent.length,
                isPrimary: Boolean(source.isPrimary)
            });

            totalCharCount += textContent.length;
            continue;
        }

        if (sourceType === 'pdf') {
            const providedText = typeof source.textContent === 'string' ? source.textContent.trim() : '';
            const rawBinary = typeof source.content === 'string' ? source.content : '';
            const extracted = providedText || extractTextFromPdfBase64(rawBinary);
            const safeText = extracted || estimateTextFromBinary(rawBinary) || '';
            const limitedText = safeText.slice(0, MAX_PDF_CHARS);
            const charCount = limitedText.length;

            normalizedSources.push({
                id: sourceId,
                originalType: source.type || 'PDF',
                resolvedType: 'pdf',
                name: source.name || 'PDF sem nome',
                extractedText: limitedText,
                charCount,
                isPrimary: Boolean(source.isPrimary)
            });

            totalCharCount += charCount;
            continue;
        }

        // Texto/outros - usar conteúdo direto
        const textContent = source.textContent || source.content || '';

        normalizedSources.push({
            id: sourceId,
            originalType: source.type || 'TEXT',
            resolvedType: sourceType,
            name: source.name || 'Fonte sem nome',
            extractedText: textContent,
            charCount: textContent.length,
            durationMinutes: source.durationMinutes,
            isPrimary: Boolean(source.isPrimary)
        });

        totalCharCount += textContent.length;
    }

    // Estimar tokens
    const inputTokens = Math.ceil(totalCharCount / 4);
    const outputTokens = limits.max_output_tokens?.['roadmap'] || 8000;
    const estimatedTokens = inputTokens + outputTokens;

    // ADMIN: Pula validações de tokens
    if (!adminBypass) {
        // Validação: tamanho do roteiro (airbag)
        if (estimatedTokens > limits.max_tokens_per_roadmap) {
            return {
                success: false,
                error: 'ROADMAP_TOO_LARGE',
                errorMessage: 'Conteúdo muito extenso. Divida em roteiros menores ou remova algumas fontes.',
                actionSuggestion: 'split_roadmap',
                estimatedTokens
            };
        }

        // Validação: limite mensal de tokens
        if (usage.monthly_tokens_used + estimatedTokens > limits.monthly_tokens) {
            return {
                success: false,
                error: 'MONTHLY_LIMIT',
                errorMessage: 'Limite mensal de processamento atingido.',
                actionSuggestion: 'view_plans',
                estimatedTokens
            };
        }
    }

    return {
        success: true,
        sources: normalizedSources,
        totalCharCount,
        totalDurationMinutes,
        estimatedTokens
    };
};
