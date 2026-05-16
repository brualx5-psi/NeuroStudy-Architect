import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assertIncludes = (content, expected, label) => {
  if (!content.includes(expected)) {
    throw new Error(`${label}: trecho esperado não encontrado: ${expected}`);
  }
};

const clientTypes = read('client/src/types.ts');
const rootTypes = read('types.ts');
const gemini = read('api/_lib/gemini.ts');
const resultsView = read('client/src/components/ResultsView.tsx');
const markdownExport = read('client/src/services/markdownExport.ts');

assertIncludes(clientTypes, 'moduleAlignment?: string', 'StudyGuide client deve aceitar alinhamento com módulo');
assertIncludes(rootTypes, 'moduleAlignment?: string', 'StudyGuide raiz deve aceitar alinhamento com módulo');
assertIncludes(gemini, 'moduleAlignment: { type: Type.STRING', 'Schema Gemini deve permitir moduleAlignment');
assertIncludes(gemini, 'sanitizedModuleContext ? MODULE_ALIGNMENT_PROPERTY : {}', 'Schema Gemini deve permitir moduleAlignment só quando houver contexto de módulo');
assertIncludes(gemini, "ALINHAMENTO COM O MODULO ('moduleAlignment')", 'Prompt deve pedir moduleAlignment quando houver contexto');
assertIncludes(gemini, 'Se a fonte estiver mais tecnica/conceitual', 'Prompt deve sinalizar desalinhamento conceitual');
assertIncludes(gemini, 'Nao invente conexoes historicas', 'Prompt deve evitar inventar conexões com o módulo');
assertIncludes(resultsView, 'Alinhamento com o módulo', 'ResultsView deve exibir bloco de alinhamento');
assertIncludes(resultsView, 'guide.moduleAlignment', 'ResultsView deve renderizar moduleAlignment quando existir');
assertIncludes(markdownExport, '## Alinhamento com o módulo', 'Export Markdown deve incluir alinhamento com módulo');

console.log('Fase 3 alinhamento com módulo: OK');
