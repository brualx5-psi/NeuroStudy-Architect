import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assertIncludes = (content, expected, label) => {
  if (!content.includes(expected)) {
    throw new Error(`${label}: trecho esperado não encontrado: ${expected}`);
  }
};

const resultsView = read('client/src/components/ResultsView.tsx');
const methodology = read('client/src/components/MethodologyModal.tsx');
const gemini = read('api/_lib/gemini.ts');
const markdownExport = read('client/src/services/markdownExport.ts');

assertIncludes(resultsView, 'Objetivo da aula', 'ResultsView deve exibir o roteiro como Objetivo da aula');
assertIncludes(markdownExport, 'Objetivo da aula', 'Exportação Markdown deve usar Objetivo da aula no roteiro exportado');
assertIncludes(markdownExport, 'Objetivo do livro', 'Exportação Markdown deve preservar Objetivo do livro em modo livro');
assertIncludes(methodology, 'Objetivo da aula é bússola', 'MethodologyModal deve explicar Objetivo da aula no Guia');
assertIncludes(methodology, 'Leia o "Objetivo da aula"', 'MethodologyModal deve orientar o uso antes da aula');
assertIncludes(gemini, "INSTRUCOES ESPECIFICAS PARA CAMPO 'overview' (Objetivo da aula)", 'Prompt deve tratar overview como Objetivo da aula');
assertIncludes(gemini, 'Qual e o objetivo desta aula?', 'Prompt deve pedir objetivo explícito da aula');
assertIncludes(gemini, 'recorte da aula', 'Prompt deve pedir recorte/contextualização da aula');

console.log('Fase 1 Objetivo da aula: OK');
