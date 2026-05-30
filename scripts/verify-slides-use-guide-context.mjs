import { readFileSync } from 'node:fs';

const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');
const planLimits = readFileSync(new URL('../api/_lib/planLimits.ts', import.meta.url), 'utf8');

const slidesStart = gemini.indexOf('export const generateSlides');
if (slidesStart === -1) {
  throw new Error('generateSlides não encontrado em api/_lib/gemini.ts');
}
const quizStart = gemini.indexOf('export const generateQuiz', slidesStart);
const slidesBlock = gemini.slice(slidesStart, quizStart === -1 ? undefined : quizStart);

const required = [
  'const guideContext = buildGuideReviewContext(guide);',
  'CONTEUDO DO ROTEIRO PARA SLIDES',
  'TEMA (apenas rotulo; nao use para puxar conteudo generico)',
  'Slides devem explicar o roteiro gerado, nao o tema generico',
  'Use os nomes, marcos, transicoes, checkpoints e conceitos que aparecem no roteiro',
  'Se a aula for historica/narrativa',
  "taskType: 'slides'"
];

for (const snippet of required) {
  if (!slidesBlock.includes(snippet)) {
    throw new Error(`Geração de slides ainda não está ancorada no roteiro: ${snippet}`);
  }
}

const forbidden = [
  'Crie uma apresentacao de Slides (.pdf style) sobre: "${guide.subject}"',
  'Contexto: Baseie-se no guia de estudo fornecido.'
];

for (const snippet of forbidden) {
  if (slidesBlock.includes(snippet)) {
    throw new Error(`Prompt antigo/genérico de slides ainda existe: ${snippet}`);
  }
}

const requiredPlanLimits = [
  "export type TokenTaskType = 'roadmap' | 'quiz' | 'flashcards' | 'chat' | 'slides';",
  'slides: 4_000',
  'slides: 8_000',
  'slides: 12_000'
];

for (const snippet of requiredPlanLimits) {
  if (!planLimits.includes(snippet)) {
    throw new Error(`Limite de tokens para slides ausente/inconsistente: ${snippet}`);
  }
}

console.log('Slides ancorados no roteiro: OK');
