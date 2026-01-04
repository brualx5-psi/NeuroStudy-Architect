const decodeBase64 = (content: string): string => {
  const raw = content.startsWith('data:') ? content.split(',')[1] : content;
  try {
    return Buffer.from(raw, 'base64').toString('latin1');
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

export const estimateTextFromBinary = (content: string) =>
  extractPrintableText(decodeBase64(content));
