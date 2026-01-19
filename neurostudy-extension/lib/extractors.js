/**
 * NeuroStudy Capture - Extractors Module
 * 
 * Extratores de legendas específicos para cada plataforma
 */

/**
 * Detectores de plataforma
 */
const PLATFORM_DETECTORS = {
    hotmart: {
        name: 'Hotmart',
        detect: () => {
            const hostname = window.location.hostname.toLowerCase();
            return hostname.includes('hotmart') || hostname.includes('club.hotmart');
        },
        extract: extractHotmart
    },

    eduzz: {
        name: 'Eduzz',
        detect: () => window.location.hostname.toLowerCase().includes('eduzz'),
        extract: extractEduzz
    },

    kiwify: {
        name: 'Kiwify',
        detect: () => window.location.hostname.toLowerCase().includes('kiwify'),
        extract: extractKiwify
    },

    nutror: {
        name: 'Nutror',
        detect: () => window.location.hostname.toLowerCase().includes('nutror'),
        extract: extractNutror
    },

    memberkit: {
        name: 'Memberkit',
        detect: () => window.location.hostname.toLowerCase().includes('memberkit'),
        extract: extractMemberkit
    },

    generic: {
        name: 'Vídeo HTML5',
        detect: () => !!document.querySelector('video'),
        extract: extractGeneric
    }
};

/**
 * Detecta a plataforma atual
 */
export function detectPlatform() {
    for (const [id, platform] of Object.entries(PLATFORM_DETECTORS)) {
        if (id !== 'generic' && platform.detect()) {
            return {
                id,
                name: platform.name,
                extractor: platform.extract
            };
        }
    }

    // Fallback para detecção genérica
    if (PLATFORM_DETECTORS.generic.detect()) {
        return {
            id: 'generic',
            name: PLATFORM_DETECTORS.generic.name,
            extractor: PLATFORM_DETECTORS.generic.extract
        };
    }

    return null;
}

/**
 * Obtém informações do vídeo na página
 */
export function getVideoInfo() {
    const video = document.querySelector('video');

    if (!video) return null;

    // Tentar obter título da página ou de elementos comuns
    const titleElement =
        document.querySelector('[class*="lesson-title"]') ||
        document.querySelector('[class*="video-title"]') ||
        document.querySelector('[class*="aula-title"]') ||
        document.querySelector('h1') ||
        document.querySelector('h2');

    return {
        title: titleElement?.textContent?.trim() || document.title,
        duration: video.duration,
        currentTime: video.currentTime,
        url: window.location.href
    };
}

/**
 * Extrator Hotmart (Sparkle Player / Vimeo)
 */
async function extractHotmart() {
    // Hotmart usa Sparkle Player (Vimeo-based)
    const tracks = document.querySelectorAll('video track[kind="subtitles"], video track[kind="captions"]');

    for (const track of tracks) {
        if (track.src) {
            try {
                const response = await fetch(track.src);
                const vttText = await response.text();
                return parseVTT(vttText);
            } catch (error) {
                console.error('Erro ao baixar legenda Hotmart:', error);
            }
        }
    }

    // Fallback: tentar capturar do TextTrack ativo
    const video = document.querySelector('video');
    if (video?.textTracks?.length > 0) {
        return extractFromTextTracks(video.textTracks);
    }

    return null;
}

/**
 * Extrator Eduzz
 */
async function extractEduzz() {
    // Eduzz geralmente usa player similar ao Hotmart
    return extractGeneric();
}

/**
 * Extrator Kiwify
 */
async function extractKiwify() {
    // Kiwify usa Bunny.net ou player próprio
    const tracks = document.querySelectorAll('video track, .vjs-text-track-display');

    for (const track of tracks) {
        if (track.src) {
            try {
                const response = await fetch(track.src);
                const vttText = await response.text();
                return parseVTT(vttText);
            } catch (error) {
                console.error('Erro ao baixar legenda Kiwify:', error);
            }
        }
    }

    return extractGeneric();
}

/**
 * Extrator Nutror
 */
async function extractNutror() {
    return extractGeneric();
}

/**
 * Extrator Memberkit
 */
async function extractMemberkit() {
    return extractGeneric();
}

/**
 * Extrator genérico para qualquer player HTML5
 */
async function extractGeneric() {
    const video = document.querySelector('video');

    if (!video) {
        return null;
    }

    // 1. Tentar extrair de elementos <track>
    const tracks = video.querySelectorAll('track[kind="subtitles"], track[kind="captions"]');

    for (const track of tracks) {
        if (track.src) {
            try {
                const response = await fetch(track.src);
                const text = await response.text();
                return parseVTT(text);
            } catch (error) {
                console.error('Erro ao baixar track:', error);
            }
        }
    }

    // 2. Tentar extrair de TextTracks ativos
    if (video.textTracks?.length > 0) {
        const result = extractFromTextTracks(video.textTracks);
        if (result) return result;
    }

    // 3. Procurar por legendas em elementos do DOM (alguns players customizados)
    const subtitleElements = document.querySelectorAll(
        '.vjs-text-track-display, ' +
        '[class*="subtitle"], ' +
        '[class*="caption"], ' +
        '[class*="legenda"]'
    );

    if (subtitleElements.length > 0) {
        // Configurar MutationObserver para capturar legendas em tempo real
        return {
            needsObserver: true,
            message: 'Este player requer captura em tempo real. Inicie o vídeo e aguarde.'
        };
    }

    return null;
}

/**
 * Extrai texto de TextTracks (legendas carregadas no player)
 */
function extractFromTextTracks(textTracks) {
    let fullTranscript = '';

    for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];

        if (track.kind === 'subtitles' || track.kind === 'captions') {
            // Ativar track se necessário
            if (track.mode === 'disabled') {
                track.mode = 'hidden';
            }

            const cues = track.cues;

            if (cues && cues.length > 0) {
                for (let j = 0; j < cues.length; j++) {
                    const cue = cues[j];
                    const timestamp = formatTimestamp(cue.startTime);
                    const text = cue.text.replace(/<[^>]+>/g, '').trim();

                    if (text) {
                        fullTranscript += `[${timestamp}] ${text}\n`;
                    }
                }
            }
        }
    }

    if (fullTranscript) {
        return {
            transcript: fullTranscript.trim(),
            hasTimestamps: true,
            cueCount: fullTranscript.split('\n').length
        };
    }

    return null;
}

/**
 * Parser de arquivos VTT/SRT
 */
export function parseVTT(content) {
    const lines = content.split('\n');
    let transcript = '';
    let currentTimestamp = null;
    let cueCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Pular linhas vazias e headers
        if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE') || /^\d+$/.test(line)) {
            continue;
        }

        // Detectar timestamp (00:00:00.000 --> 00:00:00.000 ou 00:00.000 --> 00:00.000)
        const timestampMatch = line.match(/^(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->/);

        if (timestampMatch) {
            const hours = timestampMatch[1] ? parseInt(timestampMatch[1]) : 0;
            const minutes = parseInt(timestampMatch[2]);
            const seconds = parseInt(timestampMatch[3]);

            currentTimestamp = formatTime(hours, minutes, seconds);
            continue;
        }

        // Adicionar texto com timestamp
        if (line && currentTimestamp) {
            // Remover tags HTML/VTT
            const cleanText = line.replace(/<[^>]+>/g, '').trim();

            if (cleanText) {
                transcript += `[${currentTimestamp}] ${cleanText}\n`;
                cueCount++;
            }
        }
    }

    if (!transcript) {
        return null;
    }

    return {
        transcript: transcript.trim(),
        hasTimestamps: true,
        cueCount
    };
}

/**
 * Formata segundos para MM:SS ou HH:MM:SS
 */
function formatTimestamp(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return formatTime(hours, minutes, seconds);
}

/**
 * Formata hora, minuto e segundo para string
 */
function formatTime(hours, minutes, seconds) {
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
