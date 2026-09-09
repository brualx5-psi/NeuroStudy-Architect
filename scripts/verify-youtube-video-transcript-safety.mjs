import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const sourceResolver = readFileSync(new URL('../api/_lib/sourceResolver.ts', import.meta.url), 'utf8');

if (!sourceResolver.includes('fetchYouTubeTranscript')) {
  throw new Error('sourceResolver deve tentar resolver transcrição real do YouTube antes de gerar roteiro.');
}

if (!sourceResolver.includes("sourceType === 'youtube'") || !sourceResolver.includes('actionSuggestion: \'paste_transcript\'')) {
  throw new Error('Links do YouTube sem transcrição acessível devem retornar erro claro pedindo transcrição manual.');
}

if (!sourceResolver.includes('resolvedType: \'youtube\'') || !sourceResolver.includes('extractedText: transcript.text')) {
  throw new Error('Quando houver legenda/transcrição do YouTube, o texto transcrito deve ser a fonte enviada ao Gemini.');
}

if (!sourceResolver.includes("sourceType === 'video_upload'") || !sourceResolver.includes('Upload de vídeo precisa passar pela transcrição antes de gerar roteiro')) {
  throw new Error('Upload de vídeo sem textContent/transcrição deve ser bloqueado no backend, sem fallback para base64.');
}

const quickStartIndex = app.indexOf('const handleQuickStart = async');
if (quickStartIndex === -1) {
  throw new Error('handleQuickStart não encontrado.');
}
const quickStart = app.slice(quickStartIndex, app.indexOf('const handleParetoUpload', quickStartIndex));

if (!quickStart.includes('type === InputType.VIDEO')) {
  throw new Error('Fluxo rápido/Pareto precisa tratar vídeo explicitamente antes de salvar a fonte.');
}

if (!quickStart.includes('uploadFileForTranscription(processedFile') || !quickStart.includes('transcribeMedia(fileUri')) {
  throw new Error('Fluxo rápido/Pareto de vídeo deve chamar uploadFileForTranscription -> transcribeMedia.');
}

if (!quickStart.includes('quickSourceType = InputType.TEXT') || !quickStart.includes('[Transcrição]')) {
  throw new Error('Após transcrever vídeo no fluxo rápido, a fonte deve ser salva como texto transcrito, não como vídeo/base64.');
}

console.log('Pipeline YouTube/vídeo sem fallback cego: OK');
