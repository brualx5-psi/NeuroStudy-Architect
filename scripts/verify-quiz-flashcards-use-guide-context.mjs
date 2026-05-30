import { readFileSync } from 'node:fs';

const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');

const required = [
  'const buildGuideReviewContext = (guide: any) =>',
  'CONTEUDO DO ROTEIRO PARA REVISAO',
  'Quiz e prova devem revisar o roteiro gerado, nao o tema generico',
  'Flashcards devem revisar o roteiro gerado, nao o tema generico',
  'priorize Objetivo da aula, Alinhamento com o modulo, checkpoints e conceitos do roteiro',
  'nao puxe definicoes genericas de fora so porque o assunto sugere',
  '${guideContext}'
];

for (const snippet of required) {
  if (!gemini.includes(snippet)) {
    throw new Error(`Quiz/flashcards ainda nao estao ancorados no roteiro: ${snippet}`);
  }
}

const quizStart = gemini.indexOf('export const generateQuiz');
const flashStart = gemini.indexOf('export const generateFlashcards');
const quizBlock = gemini.slice(quizStart, flashStart);
const flashBlock = gemini.slice(flashStart, gemini.indexOf('export const sendChatMessage'));

if (!quizBlock.includes('const guideContext = buildGuideReviewContext(guide);')) {
  throw new Error('generateQuiz precisa montar guideContext a partir do roteiro.');
}

if (!flashBlock.includes('const guideContext = buildGuideReviewContext(guide);')) {
  throw new Error('generateFlashcards precisa montar guideContext a partir do roteiro.');
}

console.log('Quiz e flashcards ancorados no roteiro: OK');
