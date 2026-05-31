import { readFileSync } from 'node:fs';

const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');
const resolver = readFileSync(new URL('../api/_lib/sourceResolver.ts', import.meta.url), 'utf8');
const roadmapHandler = readFileSync(new URL('../api/_handlers/ai/roadmap.ts', import.meta.url), 'utf8');
const clientTypes = readFileSync(new URL('../client/src/types.ts', import.meta.url), 'utf8');
const textExtraction = readFileSync(new URL('../client/src/services/textExtraction.ts', import.meta.url), 'utf8');
const resultsView = readFileSync(new URL('../client/src/components/ResultsView.tsx', import.meta.url), 'utf8');
const markdownExport = readFileSync(new URL('../client/src/services/markdownExport.ts', import.meta.url), 'utf8');
const pdfExport = readFileSync(new URL('../client/src/services/guidePdfExport.ts', import.meta.url), 'utf8');

const requiredGemini = [
  'TIMESTAMP_MARKER_REGEX',
  'PAGE_OR_SLIDE_MARKER_REGEX',
  'hasTimestampedTranscript',
  'hasPageOrSlideMarkers',
  'sourceLocator: { type: Type.STRING',
  'REGRA DE LOCALIZACAO DA FONTE',
  'Fonte Principal escolhida pelo usuario define o eixo do roteiro',
  "campo 'timestamp' DEVE trazer os minutos exatos para assistir",
  "preencha tambem 'sourceLocator' com a pagina/slide relacionada",
  'NAO invente minutos',
  'nao force sincronizacao',
  'SLIDE/PDF: Se a entrada for baseada em slide/PDF com marcadores de pagina'
];

for (const snippet of requiredGemini) {
  if (!gemini.includes(snippet)) {
    throw new Error(`Prompt/schema sem regra de tempo/página: ${snippet}`);
  }
}

const requiredPrimaryPreservation = [
  'isPrimary?: boolean;',
  'isPrimary: Boolean(source.isPrimary)',
  'isPrimary: Boolean(s.isPrimary)',
  '!sourcesForGemini.some(s => s.isPrimary)'
];
for (const snippet of requiredPrimaryPreservation) {
  if (!resolver.includes(snippet) && !roadmapHandler.includes(snippet)) {
    throw new Error(`Fonte principal do usuário não preservada: ${snippet}`);
  }
}

const requiredClient = [
  'sourceLocator?: string',
  'pages.push(`[Página ${pageLabel}]\\n${pageText}`)',
  'Momento/fonte',
  'Referência:',
  "pushKeyValue(lines, 'Referência da fonte', checkpoint.sourceLocator)",
  "label: 'Momento/fonte'"
];
const clientBundle = [clientTypes, textExtraction, resultsView, markdownExport, pdfExport].join('\n');
for (const snippet of requiredClient) {
  if (!clientBundle.includes(snippet)) {
    throw new Error(`Cliente/exportação sem referência de tempo/página: ${snippet}`);
  }
}

console.log('Transcrição + slides com tempo/página: OK');
