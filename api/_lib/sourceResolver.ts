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

// Tipos de fonte suportados
export type SourceType = 'youtube' | 'video_upload' | 'link_transcript' | 'text' | 'pdf' | 'unsupported_link';

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

// Padrões de YouTube
const YOUTUBE_PATTERNS = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/[\w-]+/i,
    /(?:https?:\/\/)?youtu\.be\/[\w-]+/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[\w-]+/i,
];

/**
 * Verifica se URL é do YouTube
 */
export const isYouTubeUrl = (url: string): boolean => {
    return YOUTUBE_PATTERNS.some(pattern => pattern.test(url));
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
        }
        return 'unsupported_link';
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
 */
export const prepareSourcesForRoadmap = async (
    sources: any[],
    planName: PlanName,
    usage: { youtube_minutes_used: number; roadmaps_created: number; monthly_tokens_used: number }
): Promise<PrepareSourcesResult> => {
    const limits = PLAN_LIMITS[planName];

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

    const normalizedSources: NormalizedSource[] = [];
    let totalCharCount = 0;
    let totalDurationMinutes = 0;

    for (const source of sources) {
        const sourceType = detectSourceType(source);
        const sourceId = source.id || `src-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        // Link não suportado (não é YouTube, não é transcript público)
        if (sourceType === 'unsupported_link') {
            return {
                success: false,
                error: 'UNSUPPORTED_LINK_REQUIRES_TRANSCRIPT',
                errorMessage: 'Este link parece exigir login ou não oferece transcrição acessível.',
                actionSuggestion: 'upload_file'
            };
        }

        // YouTube - validar duração
        if (sourceType === 'youtube') {
            const durationMinutes = source.durationMinutes || 0;

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

            totalDurationMinutes += durationMinutes;
        }

        // Upload de vídeo - validar duração
        if (sourceType === 'video_upload') {
            const durationMinutes = source.durationMinutes || 0;

            if (durationMinutes > limits.youtube_minutes_per_video) {
                return {
                    success: false,
                    error: 'VIDEO_TOO_LONG',
                    errorMessage: `Vídeo muito longo (${durationMinutes} min). Máximo: ${limits.youtube_minutes_per_video} min.`,
                    actionSuggestion: 'split_roadmap'
                };
            }

            totalDurationMinutes += durationMinutes;
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
                charCount: result.text.length
            });

            totalCharCount += result.text.length;
            continue;
        }

        // Texto/PDF/outros - usar conteúdo direto
        const textContent = source.textContent || source.content || '';

        normalizedSources.push({
            id: sourceId,
            originalType: source.type || 'TEXT',
            resolvedType: sourceType,
            name: source.name || 'Fonte sem nome',
            extractedText: textContent,
            charCount: textContent.length,
            durationMinutes: source.durationMinutes
        });

        totalCharCount += textContent.length;
    }

    // Estimar tokens
    const inputTokens = Math.ceil(totalCharCount / 4);
    const outputTokens = limits.max_output_tokens?.['roadmap'] || 8000;
    const estimatedTokens = inputTokens + outputTokens;

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

    return {
        success: true,
        sources: normalizedSources,
        totalCharCount,
        totalDurationMinutes,
        estimatedTokens
    };
};
