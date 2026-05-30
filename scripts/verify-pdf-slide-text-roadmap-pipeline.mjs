import { readFileSync } from 'node:fs';

const clientExtraction = readFileSync(new URL('../client/src/services/textExtraction.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const resolver = readFileSync(new URL('../api/_lib/sourceResolver.ts', import.meta.url), 'utf8');

const requiredClient = [
  "import * as pdfjsLib from 'pdfjs-dist';",
  "import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min?url';",
  'pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;',
  'export const extractTextFromPdfFile = async (file: File): Promise<string> =>',
  'const textContent = await page.getTextContent();'
];

for (const snippet of requiredClient) {
  if (!clientExtraction.includes(snippet)) {
    throw new Error(`Extração robusta de texto PDF no cliente ausente: ${snippet}`);
  }
}

const requiredApp = [
  'extractTextFromPdfFile',
  'await extractTextFromPdfFile(processedFile) || extractTextFromPdfBase64(sourceContent)',
  'await extractTextFromPdfFile(fileToProcess) || extractTextFromPdfBase64(base64Content)'
];

for (const snippet of requiredApp) {
  if (!app.includes(snippet)) {
    throw new Error(`Fluxo de upload/recorte não usa PDF.js para textContent: ${snippet}`);
  }
}

const requiredResolver = [
  "const providedText = typeof source.textContent === 'string' ? source.textContent.trim() : '';",
  'const extracted = providedText || extractTextFromPdfBase64(rawBinary);'
];

for (const snippet of requiredResolver) {
  if (!resolver.includes(snippet)) {
    throw new Error(`Backend não prioriza textContent extraído no cliente para roteiro: ${snippet}`);
  }
}

console.log('Pipeline PDF/slide -> texto -> roteiro: OK');
