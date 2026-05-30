import { readFileSync } from 'node:fs';

const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');
const handler = readFileSync(new URL('../api/_handlers/ai/chat.ts', import.meta.url), 'utf8');
const clientService = readFileSync(new URL('../client/src/services/geminiService.ts', import.meta.url), 'utf8');

const sendStart = gemini.indexOf('export const sendChatMessage');
if (sendStart === -1) throw new Error('sendChatMessage não encontrado');
const toolStart = gemini.indexOf('export const generateTool', sendStart);
const sendBlock = gemini.slice(sendStart, toolStart === -1 ? undefined : toolStart);

const requiredGemini = [
  'guide?: any',
  'const guideContext = guide ? buildGuideReviewContext(guide).slice(0, CHAT_GUIDE_CONTEXT_CHAR_LIMIT) :',
  'CONTEUDO DO ROTEIRO ATUAL',
  'CONTRATO PEDAGOGICO DO PROFESSOR SOCRATICO & ATIVO',
  'Se o aluno pedir resposta clara',
  'continue esse fio ate resolver ou ate o aluno mudar/encerrar o assunto',
  'Nao pule para outro conceito/checkpoint sem ponte explicita',
  'Se a pergunta for fora do roteiro',
  'nao parece estar conectado ao roteiro atual',
  'const maxHistory = Number(process.env.GEMINI_CHAT_HISTORY_MAX || 10)'
];

for (const snippet of requiredGemini) {
  if (!sendBlock.includes(snippet)) {
    throw new Error(`Professor socrático/ativo sem regra/contexto obrigatório: ${snippet}`);
  }
}

const requiredHandler = [
  'guide?: any;',
  'body.guide',
  'sendChatMessage(planName, body.history || [], body.message || \'\', body.guide || null)'
];
for (const snippet of requiredHandler) {
  if (!handler.includes(snippet)) {
    throw new Error(`Handler de chat não encaminha roteiro: ${snippet}`);
  }
}

const requiredClient = [
  '_studyGuide: StudyGuide | null = null',
  'guide: _studyGuide'
];
for (const snippet of requiredClient) {
  if (!clientService.includes(snippet)) {
    throw new Error(`Cliente não envia roteiro para chat: ${snippet}`);
  }
}

const forbidden = [
  "Professor virtual socratico e ativo. Responda em PT-BR. Seja natural, curto e interativo. Use 1 pergunta por vez."
];
for (const snippet of forbidden) {
  if (sendBlock.includes(snippet)) {
    throw new Error(`Prompt antigo/genérico do professor ainda existe: ${snippet}`);
  }
}

console.log('Professor socrático/ativo ancorado no roteiro: OK');
