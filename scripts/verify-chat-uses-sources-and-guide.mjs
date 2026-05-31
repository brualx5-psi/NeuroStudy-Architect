import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const widget = readFileSync(new URL('../client/src/components/ChatWidget.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../client/src/services/geminiService.ts', import.meta.url), 'utf8');
const handler = readFileSync(new URL('../api/_handlers/ai/chat.ts', import.meta.url), 'utf8');
const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');

const checks = [
  [app, 'sources={activeStudy?.sources || []}', 'App não passa fontes ativas ao ChatWidget'],
  [widget, 'sources?: StudySource[];', 'ChatWidget não tipa fontes'],
  [widget, 'sendChatMessage(messages, textToSend, studyGuide, sources)', 'ChatWidget não repassa fontes ao serviço'],
  [service, 'CHAT_SOURCE_TEXT_CHAR_LIMIT = 120_000', 'Serviço não limita texto de fonte para chat'],
  [service, 'buildChatSourcePayload(sources)', 'Serviço não sanitiza fontes antes de enviar'],
  [service, 'sources: buildChatSourcePayload(sources)', 'Serviço não envia fontes no body do chat'],
  [handler, 'sources?: any[];', 'Handler não aceita fontes no body'],
  [handler, "body.guide || null, body.sources || []", 'Handler não repassa fontes ao backend Gemini'],
  [gemini, 'CHAT_SOURCE_CONTEXT_CHAR_LIMIT = 18_000', 'Backend não limita contexto de fontes do chat'],
  [gemini, 'buildChatSourceContext', 'Backend não monta contexto das fontes'],
  [gemini, 'TRECHOS RELEVANTES DAS FONTES ENVIADAS', 'Prompt do professor não recebe bloco de fontes'],
  [gemini, 'em que minuto', 'Prompt não instrui consulta de minuto/fonte'],
  [gemini, 'isso nao virou checkpoint, mas aparece na fonte', 'Prompt não diferencia fonte vs checkpoint'],
  [gemini, 'nao finja certeza', 'Prompt não protege contra confirmação falsa sem fonte suficiente']
];

for (const [content, snippet, message] of checks) {
  if (!content.includes(snippet)) {
    throw new Error(`${message}: ${snippet}`);
  }
}

console.log('Professor Virtual usa roteiro + trechos relevantes das fontes: OK');
