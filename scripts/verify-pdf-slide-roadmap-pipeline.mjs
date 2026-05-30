import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const createSlidePdf = async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 5; i++) {
    const page = pdf.addPage([640, 360]);
    page.drawText(`SLIDE_${i}_NEUROSTUDY_TESTE`, {
      x: 50,
      y: 180,
      size: 24,
      font,
      color: rgb(0, 0, 0)
    });
  }
  return pdf.save();
};

const extractPages = async (pdfBytes, pagesOneIndexed) => {
  const source = await PDFDocument.load(pdfBytes);
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, pagesOneIndexed.map((page) => page - 1));
  copied.forEach((page) => output.addPage(page));
  return output.save();
};

const extractTextWithPdfJs = async (pdfBytes) => {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || '').join(' '));
  }
  return pages.join('\n');
};

const originalBytes = await createSlidePdf();
const original = await PDFDocument.load(originalBytes);
if (original.getPageCount() !== 5) {
  throw new Error(`PDF de teste deveria ter 5 páginas, mas tem ${original.getPageCount()}`);
}

const selectedPages = [2, 4, 5];
const reducedBytes = await extractPages(originalBytes, selectedPages);
const reduced = await PDFDocument.load(reducedBytes);
if (reduced.getPageCount() !== selectedPages.length) {
  throw new Error(`PDF recortado deveria ter ${selectedPages.length} páginas, mas tem ${reduced.getPageCount()}`);
}

const extractedText = await extractTextWithPdfJs(reducedBytes);

for (const page of selectedPages) {
  if (!extractedText.includes(`SLIDE_${page}_NEUROSTUDY_TESTE`)) {
    throw new Error(`Texto do slide/página ${page} não apareceu no PDF recortado.`);
  }
}

for (const page of [1, 3]) {
  if (extractedText.includes(`SLIDE_${page}_NEUROSTUDY_TESTE`)) {
    throw new Error(`Texto do slide/página não selecionado ${page} apareceu no PDF recortado.`);
  }
}

console.log(`PDF recortado funcional: ${original.getPageCount()} -> ${reduced.getPageCount()} páginas; PDF.js extraiu texto para roteiro OK`);
