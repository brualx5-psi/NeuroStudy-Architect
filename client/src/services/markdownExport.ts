import { StudyGuide } from '../types';

const clean = (value?: string | null) => (value || '').trim();
const cleanInline = (value?: string | null) => clean(value).replace(/\s+/g, ' ');

const pushIfPresent = (lines: string[], value?: string | null) => {
  const text = clean(value);
  if (text) {
    lines.push(text, '');
  }
};

const pushKeyValue = (lines: string[], label: string, value?: string | null) => {
  const text = clean(value);
  if (text) {
    lines.push(`**${label}:** ${text}`, '');
  }
};

const formatCorrectAnswer = (correctAnswer: number | string, options?: string[]) => {
  if (typeof correctAnswer === 'number') {
    const letter = String.fromCharCode(65 + correctAnswer);
    const optionText = options?.[correctAnswer];
    return optionText ? `${letter}. ${optionText}` : letter;
  }

  return String(correctAnswer);
};

export const getMarkdownFilename = (title?: string | null) => {
  const safeTitle = clean(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return `${safeTitle || 'neurostudy'}.md`;
};

export const buildStudyGuideMarkdown = (guide: StudyGuide) => {
  const lines: string[] = [];

  lines.push(`# ${cleanInline(guide.title) || 'Roteiro NeuroStudy'}`, '');
  pushKeyValue(lines, 'Assunto', guide.subject);

  if (guide.overview) {
    const overviewTitle = guide.bookChapters?.length ? 'Objetivo do livro' : 'Objetivo da aula';
    lines.push(`## ${overviewTitle}`, '');
    pushIfPresent(lines, guide.overview);
  }

  if (guide.globalApplication) {
    lines.push('## Aplicação Global', '');
    pushIfPresent(lines, guide.globalApplication);
  }

  if (guide.coreConcepts?.length) {
    lines.push('## Core Concepts / Conceitos Fundamentais', '');
    guide.coreConcepts.forEach((concept, index) => {
      lines.push(`### ${index + 1}. ${cleanInline(concept.concept) || 'Conceito'}`, '');
      pushIfPresent(lines, concept.definition);

      if (concept.tools?.feynman || concept.tools?.example || concept.tools?.interdisciplinary) {
        lines.push('#### Ferramentas de compreensão', '');
        pushKeyValue(lines, 'Feynman', concept.tools.feynman);
        pushKeyValue(lines, 'Exemplo', concept.tools.example);
        pushKeyValue(lines, 'Conexão interdisciplinar', concept.tools.interdisciplinary);
      }
    });
  }

  if (guide.supportConcepts?.length) {
    lines.push('## Conceitos de Suporte', '');
    guide.supportConcepts.forEach((concept, index) => {
      lines.push(`### ${index + 1}. ${cleanInline(concept.concept) || 'Conceito de suporte'}`, '');
      pushIfPresent(lines, concept.definition);
    });
  }

  if (guide.bookChapters?.length) {
    lines.push('## Capítulos', '');
    guide.bookChapters.forEach((chapter, index) => {
      lines.push(`### Capítulo ${index + 1}: ${cleanInline(chapter.title) || 'Sem título'}`, '');
      pushKeyValue(lines, 'Essência 80/20', chapter.paretoChunk);
      pushIfPresent(lines, chapter.content);

      if (chapter.coreConcepts?.length) {
        lines.push('#### Conceitos do capítulo', '');
        chapter.coreConcepts.forEach((concept, conceptIndex) => {
          lines.push(`- **${conceptIndex + 1}. ${cleanInline(concept.concept) || 'Conceito'}:** ${clean(concept.definition)}`);
        });
        lines.push('');
      }

      if (chapter.supportConcepts?.length) {
        lines.push('#### Conceitos de suporte do capítulo', '');
        chapter.supportConcepts.forEach((concept) => {
          lines.push(`- **${cleanInline(concept.concept) || 'Conceito'}:** ${clean(concept.definition)}`);
        });
        lines.push('');
      }

      pushKeyValue(lines, 'Check mental', chapter.reflectionQuestion);
    });
  }

  if (guide.checkpoints?.length) {
    lines.push('## Checkpoints / Checklist de Estudo', '');
    guide.checkpoints.forEach((checkpoint, index) => {
      lines.push(`### Checkpoint ${index + 1}${checkpoint.timestamp ? ` — ${checkpoint.timestamp}` : ''}`, '');
      pushKeyValue(lines, 'Missão', checkpoint.mission);
      pushKeyValue(lines, 'O que procurar', checkpoint.lookFor);
      pushKeyValue(lines, 'Escreva exatamente isso', checkpoint.noteExactly);
      pushKeyValue(lines, 'Sugestão de desenho', checkpoint.drawExactly);
      pushKeyValue(lines, 'Pergunta de recuperação', checkpoint.question);
    });
  }

  if (guide.tools) {
    const hasTools = guide.tools.mnemonics || guide.tools.interdisciplinary || guide.tools.realWorldApplication || guide.tools.explainLikeIm5;
    if (hasTools) {
      lines.push('## Ferramentas Extras', '');
      pushKeyValue(lines, 'Mnemônicos', guide.tools.mnemonics);
      pushKeyValue(lines, 'Conexões interdisciplinares', guide.tools.interdisciplinary);
      pushKeyValue(lines, 'Aplicação no mundo real', guide.tools.realWorldApplication);
      pushKeyValue(lines, 'Explicação simples', guide.tools.explainLikeIm5);
    }
  }

  if (guide.quiz?.length) {
    lines.push('## Quiz', '');
    guide.quiz.forEach((question, index) => {
      lines.push(`### Questão ${index + 1}`, '');
      pushIfPresent(lines, question.question);
      if (Array.isArray(question.options)) {
        question.options.forEach((option, optionIndex) => {
          lines.push(`- ${String.fromCharCode(65 + optionIndex)}. ${option}`);
        });
        lines.push('');
      }
      pushKeyValue(lines, 'Resposta correta', formatCorrectAnswer(question.correctAnswer, question.options));
      pushKeyValue(lines, 'Explicação', question.explanation);
    });
  }

  if (guide.flashcards?.length) {
    lines.push('## Flashcards', '');
    guide.flashcards.forEach((card, index) => {
      lines.push(`### Flashcard ${index + 1}`, '');
      pushKeyValue(lines, 'Frente', card.front);
      pushKeyValue(lines, 'Verso', card.back);
    });
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
};
