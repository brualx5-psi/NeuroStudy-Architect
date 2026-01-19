/**
 * NeuroStudy Capture - Content Script
 * 
 * Injected in course pages to detect and extract subtitles/captions
 */

// Importar de forma inline (content scripts não suportam ES modules diretamente)
// As funções estão bundled aqui para funcionar

// ============== EXTRACTORS (inline) ==============

const PLATFORM_DETECTORS = {
    hotmart: {
        name: 'Hotmart',
        detect: () => {
            const hostname = window.location.hostname.toLowerCase();
            return hostname.includes('hotmart') || hostname.includes('club.hotmart');
        }
    },
    eduzz: {
        name: 'Eduzz',
        detect: () => window.location.hostname.toLowerCase().includes('eduzz')
    },
    kiwify: {
        name: 'Kiwify',
        detect: () => window.location.hostname.toLowerCase().includes('kiwify')
    },
    nutror: {
        name: 'Nutror',
        detect: () => window.location.hostname.toLowerCase().includes('nutror')
    },
    memberkit: {
        name: 'Memberkit',
        detect: () => window.location.hostname.toLowerCase().includes('memberkit')
    }
};

function detectPlatform() {
    for (const [id, platform] of Object.entries(PLATFORM_DETECTORS)) {
        if (platform.detect()) {
            return { id, name: platform.name };
        }
    }

    // Verificar se há vídeo na página
    if (document.querySelector('video')) {
        return { id: 'generic', name: 'Vídeo HTML5' };
    }

    return null;
}

function getVideoInfo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const titleElement =
        document.querySelector('[class*="lesson-title"]') ||
        document.querySelector('[class*="video-title"]') ||
        document.querySelector('[class*="aula-title"]') ||
        document.querySelector('h1') ||
        document.querySelector('h2');

    return {
        title: titleElement?.textContent?.trim() || document.title,
        duration: video.duration,
        url: window.location.href
    };
}

async function extractTranscript() {
    const video = document.querySelector('video');

    if (!video) {
        return { success: false, error: 'Nenhum vídeo encontrado na página' };
    }

    // 1. Tentar extrair de elementos <track>
    const tracks = video.querySelectorAll('track[kind="subtitles"], track[kind="captions"]');

    for (const track of tracks) {
        if (track.src) {
            try {
                const response = await fetch(track.src);
                const text = await response.text();
                const result = parseVTT(text);

                if (result) {
                    return { success: true, transcript: result.transcript };
                }
            } catch (error) {
                console.error('Erro ao baixar track:', error);
            }
        }
    }

    // 2. Tentar extrair de TextTracks ativos
    if (video.textTracks && video.textTracks.length > 0) {
        const result = extractFromTextTracks(video.textTracks);
        if (result) {
            return { success: true, transcript: result.transcript };
        }
    }

    // 3. Procurar por tracks em iframes (Vimeo, etc.)
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        const src = iframe.src || '';
        if (src.includes('vimeo') || src.includes('player')) {
            return {
                success: false,
                error: 'Vídeo em iframe detectado. As legendas podem não estar acessíveis.'
            };
        }
    }

    return {
        success: false,
        error: 'Nenhuma legenda encontrada. Verifique se o vídeo tem legendas ativadas.'
    };
}

function extractFromTextTracks(textTracks) {
    let fullTranscript = '';

    for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];

        if (track.kind === 'subtitles' || track.kind === 'captions') {
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

    return fullTranscript ? { transcript: fullTranscript.trim() } : null;
}

function parseVTT(content) {
    const lines = content.split('\n');
    let transcript = '';
    let currentTimestamp = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE') || /^\d+$/.test(line)) {
            continue;
        }

        const timestampMatch = line.match(/^(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->/);

        if (timestampMatch) {
            const hours = timestampMatch[1] ? parseInt(timestampMatch[1]) : 0;
            const minutes = parseInt(timestampMatch[2]);
            const seconds = parseInt(timestampMatch[3]);
            currentTimestamp = formatTime(hours, minutes, seconds);
            continue;
        }

        if (line && currentTimestamp) {
            const cleanText = line.replace(/<[^>]+>/g, '').trim();
            if (cleanText) {
                transcript += `[${currentTimestamp}] ${cleanText}\n`;
            }
        }
    }

    return transcript ? { transcript: transcript.trim() } : null;
}

function formatTimestamp(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return formatTime(hours, minutes, seconds);
}

function formatTime(hours, minutes, seconds) {
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============== MESSAGE HANDLERS ==============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_PLATFORM') {
        const platform = detectPlatform();

        if (platform) {
            sendResponse({
                detected: true,
                platform: platform.name,
                videoInfo: getVideoInfo()
            });
        } else {
            sendResponse({ detected: false });
        }

        return true; // async response
    }

    if (message.type === 'EXTRACT_TRANSCRIPT') {
        extractTranscript().then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });

        return true; // async response
    }
});

// Notificar que o content script está carregado
console.log('[NeuroStudy Capture] Content script loaded on:', window.location.hostname);
