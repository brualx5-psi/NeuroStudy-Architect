/**
 * Utilitários para detecção e validação de URLs de vídeo
 */

// Padrões de URLs suportadas
const YOUTUBE_PATTERNS = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/[\w-]+/i,
    /(?:https?:\/\/)?youtu\.be\/[\w-]+/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[\w-]+/i,
];

const VIMEO_PATTERNS = [
    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/\d+/i,
    /(?:https?:\/\/)?player\.vimeo\.com\/video\/\d+/i,
];

export type VideoUrlType = 'youtube' | 'vimeo' | 'unsupported';

/**
 * Verifica se a URL é do YouTube
 */
export const isYouTubeUrl = (url: string): boolean => {
    return YOUTUBE_PATTERNS.some(pattern => pattern.test(url));
};

/**
 * Verifica se a URL é do Vimeo
 */
export const isVimeoUrl = (url: string): boolean => {
    return VIMEO_PATTERNS.some(pattern => pattern.test(url));
};

/**
 * Detecta se uma URL parece ser de vídeo (por extensão ou domínio)
 */
export const looksLikeVideoUrl = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    const videoKeywords = ['video', 'watch', 'play', 'embed', 'stream', 'aula', 'curso'];

    const lowerUrl = url.toLowerCase();

    // Verifica extensões de vídeo
    if (videoExtensions.some(ext => lowerUrl.includes(ext))) return true;

    // Verifica palavras-chave comuns em URLs de vídeo
    if (videoKeywords.some(keyword => lowerUrl.includes(keyword))) return true;

    // Plataformas conhecidas de cursos/EAD
    const eadPlatforms = ['hotmart', 'eduzz', 'kiwify', 'eadbox', 'nutror', 'memberkit', 'sparkle'];
    if (eadPlatforms.some(platform => lowerUrl.includes(platform))) return true;

    return false;
};

/**
 * Classifica o tipo de URL de vídeo
 */
export const getVideoUrlType = (url: string): VideoUrlType => {
    if (isYouTubeUrl(url)) return 'youtube';
    if (isVimeoUrl(url)) return 'vimeo';
    return 'unsupported';
};

/**
 * Verifica se a URL é suportada para processamento automático
 */
export const isSupportedVideoUrl = (url: string): boolean => {
    return getVideoUrlType(url) !== 'unsupported';
};

/**
 * Extrai o ID do vídeo do YouTube
 */
export const extractYouTubeVideoId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]+)/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }

    return null;
};
