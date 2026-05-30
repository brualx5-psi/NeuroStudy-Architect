import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const decodeBase64 = (content: string): string => {
  const raw = content.startsWith('data:') ? content.split(',')[1] : content;
  try {
    return atob(raw);
  } catch {
    return '';
  }
};

const extractPrintableText = (raw: string) => raw.replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, ' ');

export const extractTextFromPdfBase64 = (content: string): string => {
  const raw = decodeBase64(content);
  if (!raw) return '';

  const chunks: string[] = [];
  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  let match: RegExpExecArray | null;

  while ((match = tjRegex.exec(raw)) !== null) {
    if (match[1]) chunks.push(match[1]);
  }

  const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(raw)) !== null) {
    const parts = match[1].match(/\(([^)]*)\)/g) || [];
    parts.forEach((part) => {
      const cleaned = part.slice(1, -1);
      if (cleaned) chunks.push(cleaned);
    });
  }

  const extracted = chunks.join(' ').trim();
  if (extracted) return extracted;

  return extractPrintableText(raw);
};

export const estimateTextFromBinary = (content: string) => extractPrintableText(decodeBase64(content));

export const extractTextFromPdfFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) pages.push(`[Página ${pageNumber}]\n${pageText}`);
    }

    return pages.join('\n\n').trim();
  } catch (error) {
    console.warn('[textExtraction] Falha ao extrair texto do PDF com PDF.js:', error);
    return '';
  }
};
