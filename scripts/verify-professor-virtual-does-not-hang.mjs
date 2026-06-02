import { readFileSync } from 'node:fs';

const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');
const chatWidget = readFileSync(new URL('../client/src/components/ChatWidget.tsx', import.meta.url), 'utf8');
const clientService = readFileSync(new URL('../client/src/services/geminiService.ts', import.meta.url), 'utf8');

const sendStart = gemini.indexOf('export const sendChatMessage');
if (sendStart === -1) throw new Error('sendChatMessage não encontrado em api/_lib/gemini.ts');
const sendEnd = gemini.indexOf('export const generateTool', sendStart);
const sendBlock = gemini.slice(sendStart, sendEnd === -1 ? undefined : sendEnd);

const requiredBackend = [
  'callGemini({',
  "taskType: 'chat'",
  'timeoutMs: 45_000',
  "m.id !== 'welcome' && m.id !== 'new-topic'",
  'HISTORICO RECENTE DA CONVERSA',
  'pode conter perguntas ainda sem resposta se uma chamada anterior falhou',
  'PERGUNTA ATUAL DO ALUNO',
  'systemInstruction'
];

for (const snippet of requiredBackend) {
  if (!sendBlock.includes(snippet)) {
    throw new Error(`Backend do Professor Virtual sem proteção obrigatória: ${snippet}`);
  }
}

const forbiddenBackend = [
  'ai.chats.create',
  'chat.sendMessage',
  'history: trimmedHistory'
];
for (const snippet of forbiddenBackend) {
  if (sendBlock.includes(snippet)) {
    throw new Error(`Backend ainda usa chat history frágil do Gemini: ${snippet}`);
  }
}

const requiredClient = [
  'options?: { timeoutMs?: number }',
  'new AbortController()',
  'Tempo esgotado. O Professor Virtual não respondeu a tempo',
  "'/api/ai?action=chat'",
  '{ timeoutMs: 75_000 }'
];
for (const snippet of requiredClient) {
  if (!clientService.includes(snippet)) {
    throw new Error(`Cliente do Professor Virtual sem timeout/proteção: ${snippet}`);
  }
}

const requiredWidget = [
  'Não consegui responder agora',
  'setMessages(prev => [...prev, botMsg])',
  'setIsLoading(false)'
];
for (const snippet of requiredWidget) {
  if (!chatWidget.includes(snippet)) {
    throw new Error(`ChatWidget ainda pode falhar silenciosamente: ${snippet}`);
  }
}

console.log('OK: Professor Virtual evita histórico inválido, tem timeout e mostra erro visível.');
