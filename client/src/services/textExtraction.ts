import JSZip from 'jszip';

const decodeBase64 = (content: string): string => {
  const raw = content.startsWith('data:') ? content.split(',')[1] : content;
  try {
    return atob(raw);
  } catch {
    return '';
  }
};

const extractPrintableText = (raw: string) => raw.replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, ' ');

const decodeXmlEntities = (text: string) => text
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&#xA;|&#10;/g, '\n')
  .replace(/&#x9;|&#9;/g, '\t');

const extractSlideText = (xml: string): string => {
  const paragraphMatches = xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) || [];
  const paragraphs = paragraphMatches
    .map((paragraph) => {
      const textRuns = [...paragraph.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((match) => decodeXmlEntities(match[1] || '').trim())
        .filter(Boolean);
      return textRuns.join(' ').trim();
    })
    .filter(Boolean);

  return paragraphs.join('\n').trim();
};

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

export const extractTextFromPptxFile = async (file: File): Promise<string> => {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideFiles = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((a, b) => {
        const aNum = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
        const bNum = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
        return aNum - bNum;
      });

    const slides: string[] = [];

    for (let index = 0; index < slideFiles.length; index += 1) {
      const xml = await zip.file(slideFiles[index])?.async('string');
      if (!xml) continue;
      const slideText = extractSlideText(xml);
      if (slideText) {
        slides.push(`Slide ${index + 1}:\n${slideText}`);
      }
    }

    return slides.join('\n\n').trim();
  } catch {
    return '';
  }
};

export const estimateTextFromBinary = (content: string) => extractPrintableText(decodeBase64(content));
