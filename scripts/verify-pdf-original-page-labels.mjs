import { readFileSync } from 'node:fs';

const app = readFileSync('client/src/App.tsx', 'utf8');
const textExtraction = readFileSync('client/src/services/textExtraction.ts', 'utf8');

const requiredTextExtractionSnippets = [
  'extractTextFromPdfFile = async (file: File, originalPageNumbers?: number[])',
  'const pageLabel = originalPageNumbers?.[pageNumber - 1] ?? pageNumber;',
  'pages.push(`[Página ${pageLabel}]\\n${pageText}`)'
];

const requiredAppSnippets = [
  "const originalPageNumbers = pageSelection?.mode !== 'all' ? pageSelection?.parsedPages : undefined;",
  'extractTextFromPdfFile(processedFile, originalPageNumbers)',
  "const originalPageNumbers = selection.mode !== 'all' ? selection.parsedPages : undefined;",
  'extractTextFromPdfFile(fileToProcess, originalPageNumbers)'
];

const missing = [];
for (const snippet of requiredTextExtractionSnippets) {
  if (!textExtraction.includes(snippet)) missing.push(`textExtraction.ts: ${snippet}`);
}
for (const snippet of requiredAppSnippets) {
  if (!app.includes(snippet)) missing.push(`App.tsx: ${snippet}`);
}

if (missing.length) {
  console.error('Rotulagem por página original do PDF recortado: FALHOU');
  for (const item of missing) console.error(`- ausente: ${item}`);
  process.exit(1);
}

console.log('Rotulagem por página original do PDF recortado: OK');
console.log('Ex.: extração 10-15 gera [Página 10]...[Página 15], não [Página 1]...[Página 6].');
