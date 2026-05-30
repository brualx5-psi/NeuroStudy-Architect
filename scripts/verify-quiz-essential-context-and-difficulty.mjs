import { readFileSync } from 'node:fs';

const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');

const required = [
  'const buildBalancedDifficultyInstruction = (qty: number, difficulty:',
  'const base = Math.floor(qty / 3);',
  'const counts = { easy: base, medium: base, hard: base };',
  'FOCO NOS CONTEXTOS ESSENCIAIS DO ROTEIRO',
  'Nao distribua as questoes de forma uniforme por todos os termos',
  '70% das questoes devem avaliar contextos essenciais',
  'Detalhes perifericos so devem aparecer quando ajudam a compreender um contexto essencial',
  'EXATAMENTE ${counts.easy} easy, ${counts.medium} medium e ${counts.hard} hard',
  'Se forem 12 questoes no modo misto, gere 4 easy, 4 medium e 4 hard'
];

for (const snippet of required) {
  if (!gemini.includes(snippet)) {
    throw new Error(`Foco essencial/dificuldade balanceada ausente: ${snippet}`);
  }
}

const quizStart = gemini.indexOf('export const generateQuiz');
const flashStart = gemini.indexOf('export const generateFlashcards');
const quizBlock = gemini.slice(quizStart, flashStart);
const flashBlock = gemini.slice(flashStart, gemini.indexOf('export const sendChatMessage'));

if (!quizBlock.includes('${essentialContextInstruction}')) {
  throw new Error('generateQuiz deve injetar essentialContextInstruction.');
}

if (!quizBlock.includes('const difficultyInstruction = buildBalancedDifficultyInstruction(qty, difficulty);')) {
  throw new Error('generateQuiz deve usar distribuicao balanceada de dificuldade.');
}

if (!flashBlock.includes('${essentialContextInstruction}')) {
  throw new Error('generateFlashcards deve injetar essentialContextInstruction.');
}

console.log('Quiz/flashcards priorizam contextos essenciais e dificuldade mista balanceada: OK');
