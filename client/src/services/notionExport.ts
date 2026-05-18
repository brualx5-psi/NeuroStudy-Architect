import { StudyGuide } from '../types';
import { buildStudyGuideMarkdown, getMarkdownFilename } from './markdownExport';

const getNotionFilename = (title?: string | null) => {
  return getMarkdownFilename(title).replace(/\.md$/i, '_notion.md');
};

const downloadMarkdownFallback = (markdown: string, title?: string | null) => {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getNotionFilename(title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export async function exportGuideToNotion(guide: StudyGuide): Promise<void> {
  const markdown = buildStudyGuideMarkdown(guide);

  try {
    await navigator.clipboard.writeText(markdown);
    alert('Conteúdo copiado em Markdown compatível com Notion. Abra uma página no Notion e cole (Ctrl+V).');
  } catch (error) {
    console.warn('[Notion Export] Clipboard indisponível, baixando Markdown para importação:', error);
    downloadMarkdownFallback(markdown, guide.title);
    alert('Não consegui copiar automaticamente. Baixei um arquivo .md compatível para importar no Notion.');
  }
}
