import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const clientTypes = readFileSync(new URL('../client/src/types.ts', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../client/src/components/SourcePreviewModal.tsx', import.meta.url), 'utf8');

const requiredTypes = [
  'export interface PdfPageSelectionMetadata',
  "mode: 'all' | 'range' | 'visual';",
  'selectedPages?: number[];',
  'selectedPageCount?: number;',
  'originalPageCount?: number;',
  'processedPageCount?: number;',
  'pdfPageSelection?: PdfPageSelectionMetadata;'
];

for (const snippet of requiredTypes) {
  if (!clientTypes.includes(snippet)) {
    throw new Error(`Metadata de seleção de PDF ausente em client/src/types.ts: ${snippet}`);
  }
}

const requiredApp = [
  'buildPdfPageSelectionMetadata',
  'getPdfSelectionLabel',
  'pdfPageSelection',
  'const pdfPageSelection = await buildPdfPageSelectionMetadata',
  'alert(\'Não consegui recortar o PDF selecionado. Nada foi enviado ainda. Tente novamente ou use todas as páginas.\');',
  'return;',
  'PDF recortado',
  'PDF completo'
];

for (const snippet of requiredApp) {
  if (!app.includes(snippet)) {
    throw new Error(`UX/fluxo de PDF recortado ausente em App.tsx: ${snippet}`);
  }
}

const forbiddenFallbacks = [
  '// Se falhar, usa o arquivo original',
  '// Se falhar, usa arquivo original'
];

for (const snippet of forbiddenFallbacks) {
  if (app.includes(snippet)) {
    throw new Error(`Fallback silencioso para PDF original ainda existe: ${snippet}`);
  }
}

const requiredPreview = [
  'getPreviewPdfLabel',
  'Visualizando',
  'O preview abre na 1ª página',
  'role dentro do PDF para ver as demais',
  'source.pdfPageSelection'
];

for (const snippet of requiredPreview) {
  if (!preview.includes(snippet)) {
    throw new Error(`Preview de PDF recortado sem confirmação visual: ${snippet}`);
  }
}

console.log('UX de confirmação de PDF recortado: OK');
