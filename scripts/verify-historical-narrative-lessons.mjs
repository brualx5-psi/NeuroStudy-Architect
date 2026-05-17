import { readFileSync } from 'node:fs';

const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');

const required = [
  'DETECCAO DE AULA HISTORICA/NARRATIVA',
  'CONCEITUAL/TECNICA, HISTORICA/NARRATIVA ou MISTA',
  'use a Fonte Principal para decidir se ha marcos cronologicos reais a preservar',
  'Se for MISTA, combine os dois eixos',
  'Core Concepts podem ser eventos, autores, estudos, periodicos, transicoes institucionais',
  'nao transforme a aula em glossario generico de conceitos',
  'marco narrativo/cronologico central, nao uma definicao solta',
  'personagens, datas/decadas, estudos, instituicoes',
  'registre a cadeia historica em topicos curtos',
  'Evite checkpoints genericos de definicao quando a fonte usa conceitos tecnicos apenas como contexto historico'
];

for (const snippet of required) {
  if (!gemini.includes(snippet)) {
    throw new Error(`Prompt de aulas historicas/narrativas incompleto: ${snippet}`);
  }
}

if (!gemini.includes('${historicalNarrativeInstruction}')) {
  throw new Error('MASTER_PROMPT deve injetar historicalNarrativeInstruction.');
}

console.log('Aulas historicas/narrativas preservam linha do tempo: OK');
