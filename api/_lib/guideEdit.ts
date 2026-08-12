/**
 * Motor de edição assistida do roteiro.
 *
 * O modelo nunca reescreve o roteiro inteiro: ele devolve operações pontuais
 * (`set`, `insert`, `remove`) apontando para caminhos permitidos. Aqui essas
 * operações são validadas e aplicadas sobre uma cópia do roteiro, gerando uma
 * lista legível de mudanças que o usuário aprova (ou descarta) no cliente.
 */

export type GuideEditOperationInput = {
  op?: string;
  path?: string;
  value?: string;
  fields?: Array<{ key?: string; value?: string }>;
};

export type AppliedGuideChange = {
  op: 'set' | 'insert' | 'remove';
  path: string;
  label: string;
  before: string;
  after: string;
};

export type RejectedGuideChange = {
  path: string;
  reason: string;
};

export type ApplyGuideOperationsResult = {
  guide: any;
  changes: AppliedGuideChange[];
  rejected: RejectedGuideChange[];
};

const TOP_LEVEL_TEXT_FIELDS = [
  'title',
  'subject',
  'overview',
  'moduleAlignment',
  'globalApplication'
] as const;

type CollectionConfig = {
  label: string;
  fields: string[];
  identityField: string;
  requiredFields: string[];
};

const CONCEPT_COLLECTION: CollectionConfig = {
  label: 'Conceito',
  fields: ['concept', 'definition'],
  identityField: 'concept',
  requiredFields: ['concept', 'definition']
};

const ROOT_COLLECTIONS: Record<string, CollectionConfig> = {
  coreConcepts: { ...CONCEPT_COLLECTION, label: 'Conceito fundamental' },
  supportConcepts: { ...CONCEPT_COLLECTION, label: 'Conceito de suporte' },
  checkpoints: {
    label: 'Checkpoint',
    fields: ['title', 'mission', 'timestamp', 'sourceLocator', 'lookFor', 'noteExactly', 'drawExactly', 'question'],
    identityField: 'title',
    requiredFields: ['mission', 'lookFor', 'noteExactly']
  },
  bookChapters: {
    label: 'Capítulo',
    fields: ['title', 'content', 'paretoChunk', 'reflectionQuestion'],
    identityField: 'title',
    requiredFields: ['title', 'paretoChunk']
  }
};

const CHAPTER_COLLECTIONS: Record<string, CollectionConfig> = {
  coreConcepts: { ...CONCEPT_COLLECTION, label: 'Conceito do capítulo' },
  supportConcepts: { ...CONCEPT_COLLECTION, label: 'Conceito complementar do capítulo' }
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  subject: 'Assunto',
  overview: 'Objetivo da aula/livro',
  moduleAlignment: 'Alinhamento com o módulo',
  globalApplication: 'Aplicação global',
  concept: 'Nome do conceito',
  definition: 'Definição',
  mission: 'Missão',
  timestamp: 'Momento/fonte',
  sourceLocator: 'Referência da fonte',
  lookFor: 'O que procurar',
  noteExactly: 'Escreva exatamente isso',
  drawExactly: 'Sugestão de desenho',
  question: 'Pergunta do checkpoint',
  content: 'Conteúdo do capítulo',
  paretoChunk: 'Essência 80/20',
  reflectionQuestion: 'Check mental'
};

const MAX_OPERATIONS = 40;
const MAX_VALUE_CHARS = 8_000;

const SEGMENT_REGEX = /^([a-zA-Z][a-zA-Z0-9]*)(?:\[(\d+)\])?$/;

type PathSegment = { key: string; index: number | null };

const parsePath = (rawPath: string): PathSegment[] | null => {
  const path = String(rawPath || '').trim();
  if (!path) return null;

  const segments: PathSegment[] = [];
  for (const rawSegment of path.split('.')) {
    const match = SEGMENT_REGEX.exec(rawSegment.trim());
    if (!match) return null;
    segments.push({
      key: match[1],
      index: match[2] === undefined ? null : Number(match[2])
    });
  }
  return segments;
};

const normalizeText = (value: any) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').trim();
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

const describeItem = (item: any, config: CollectionConfig) => {
  const identity = normalizeText(item?.[config.identityField]);
  if (identity) return identity;
  const fallbackField = config.fields.find((field) => normalizeText(item?.[field]));
  return fallbackField ? normalizeText(item?.[fallbackField]).slice(0, 120) : '(item vazio)';
};

const buildItemFromFields = (
  fields: Array<{ key?: string; value?: string }> | undefined,
  config: CollectionConfig
): { item: Record<string, string> | null; missing: string[] } => {
  const item: Record<string, string> = {};

  for (const field of fields || []) {
    const key = String(field?.key || '').trim();
    if (!config.fields.includes(key)) continue;
    const value = normalizeText(field?.value).slice(0, MAX_VALUE_CHARS);
    if (value) item[key] = value;
  }

  const missing = config.requiredFields.filter((field) => !item[field]);
  if (missing.length) return { item: null, missing };
  return { item, missing: [] };
};

const ensureArray = (owner: any, key: string) => {
  if (!Array.isArray(owner[key])) owner[key] = [];
  return owner[key] as any[];
};

const createCheckpointId = (index: number) =>
  `cp-edit-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`;

type ResolvedTarget =
  | { kind: 'field'; owner: any; field: string; label: string }
  | { kind: 'item'; collection: any[]; index: number; config: CollectionConfig; ownerLabel: string };

const resolveTarget = (guide: any, segments: PathSegment[]): { target: ResolvedTarget | null; reason?: string } => {
  const [first, second, third] = segments;

  if (!first) return { target: null, reason: 'caminho vazio' };

  // title / overview / moduleAlignment ...
  if (segments.length === 1 && first.index === null) {
    if (!(TOP_LEVEL_TEXT_FIELDS as readonly string[]).includes(first.key)) {
      return { target: null, reason: 'campo de texto não editável' };
    }
    return { target: { kind: 'field', owner: guide, field: first.key, label: FIELD_LABELS[first.key] || first.key } };
  }

  // coreConcepts[2] / checkpoints[0] / bookChapters[1]
  if (segments.length === 1 && first.index !== null) {
    const config = ROOT_COLLECTIONS[first.key];
    if (!config) return { target: null, reason: 'lista não editável' };
    return {
      target: {
        kind: 'item',
        collection: ensureArray(guide, first.key),
        index: first.index,
        config,
        ownerLabel: config.label
      }
    };
  }

  // coreConcepts[2].definition / checkpoints[0].lookFor / bookChapters[1].paretoChunk
  if (segments.length === 2 && first.index !== null && second.index === null) {
    const config = ROOT_COLLECTIONS[first.key];
    if (!config) return { target: null, reason: 'lista não editável' };
    if (!config.fields.includes(second.key)) return { target: null, reason: 'campo não editável nesta lista' };

    const collection = ensureArray(guide, first.key);
    const item = collection[first.index];
    if (!item) return { target: null, reason: 'item inexistente' };

    return {
      target: {
        kind: 'field',
        owner: item,
        field: second.key,
        label: `${config.label} ${first.index + 1} · ${FIELD_LABELS[second.key] || second.key}`
      }
    };
  }

  // bookChapters[1].coreConcepts[0]
  if (segments.length === 2 && first.key === 'bookChapters' && first.index !== null && second.index !== null) {
    const config = CHAPTER_COLLECTIONS[second.key];
    if (!config) return { target: null, reason: 'lista não editável dentro do capítulo' };

    const chapter = ensureArray(guide, 'bookChapters')[first.index];
    if (!chapter) return { target: null, reason: 'capítulo inexistente' };

    return {
      target: {
        kind: 'item',
        collection: ensureArray(chapter, second.key),
        index: second.index,
        config,
        ownerLabel: `Capítulo ${first.index + 1} · ${config.label}`
      }
    };
  }

  // bookChapters[1].coreConcepts[0].definition
  if (
    segments.length === 3 &&
    first.key === 'bookChapters' &&
    first.index !== null &&
    second.index !== null &&
    third.index === null
  ) {
    const config = CHAPTER_COLLECTIONS[second.key];
    if (!config) return { target: null, reason: 'lista não editável dentro do capítulo' };
    if (!config.fields.includes(third.key)) return { target: null, reason: 'campo não editável nesta lista' };

    const chapter = ensureArray(guide, 'bookChapters')[first.index];
    if (!chapter) return { target: null, reason: 'capítulo inexistente' };

    const item = ensureArray(chapter, second.key)[second.index];
    if (!item) return { target: null, reason: 'item inexistente' };

    return {
      target: {
        kind: 'field',
        owner: item,
        field: third.key,
        label: `Capítulo ${first.index + 1} · ${config.label} ${second.index + 1} · ${FIELD_LABELS[third.key] || third.key}`
      }
    };
  }

  return { target: null, reason: 'caminho não suportado' };
};

export const applyGuideOperations = (
  originalGuide: any,
  operations: GuideEditOperationInput[]
): ApplyGuideOperationsResult => {
  const guide = clone(originalGuide || {});
  const changes: AppliedGuideChange[] = [];
  const rejected: RejectedGuideChange[] = [];

  const list = Array.isArray(operations) ? operations.slice(0, MAX_OPERATIONS) : [];

  for (const operation of list) {
    const op = String(operation?.op || '').trim().toLowerCase();
    const rawPath = String(operation?.path || '').trim();

    if (!['set', 'insert', 'remove'].includes(op)) {
      rejected.push({ path: rawPath, reason: 'operação desconhecida' });
      continue;
    }

    const segments = parsePath(rawPath);
    if (!segments) {
      rejected.push({ path: rawPath, reason: 'caminho inválido' });
      continue;
    }

    const { target, reason } = resolveTarget(guide, segments);
    if (!target) {
      rejected.push({ path: rawPath, reason: reason || 'caminho não encontrado' });
      continue;
    }

    if (op === 'set') {
      if (target.kind !== 'field') {
        rejected.push({ path: rawPath, reason: 'só é possível reescrever campos de texto' });
        continue;
      }

      const nextValue = normalizeText(operation?.value).slice(0, MAX_VALUE_CHARS);
      if (!nextValue) {
        rejected.push({ path: rawPath, reason: 'novo texto vazio' });
        continue;
      }

      const before = normalizeText(target.owner[target.field]);
      if (before === nextValue) {
        rejected.push({ path: rawPath, reason: 'texto igual ao atual' });
        continue;
      }

      target.owner[target.field] = nextValue;
      changes.push({ op: 'set', path: rawPath, label: target.label, before, after: nextValue });
      continue;
    }

    if (op === 'insert') {
      if (target.kind !== 'item') {
        rejected.push({ path: rawPath, reason: 'inserção precisa apontar para uma posição de lista' });
        continue;
      }

      const { item, missing } = buildItemFromFields(operation?.fields, target.config);
      if (!item) {
        rejected.push({ path: rawPath, reason: `faltam campos obrigatórios: ${missing.join(', ')}` });
        continue;
      }

      const position = Math.min(Math.max(target.index, 0), target.collection.length);
      const newItem: Record<string, any> = { ...item };
      if (target.config === ROOT_COLLECTIONS.checkpoints) {
        newItem.id = createCheckpointId(position);
        newItem.completed = false;
      }

      target.collection.splice(position, 0, newItem);
      changes.push({
        op: 'insert',
        path: rawPath,
        label: `${target.ownerLabel} adicionado (posição ${position + 1})`,
        before: '',
        after: describeItem(newItem, target.config)
      });
      continue;
    }

    // remove
    if (target.kind !== 'item') {
      rejected.push({ path: rawPath, reason: 'remoção precisa apontar para um item de lista' });
      continue;
    }

    const existing = target.collection[target.index];
    if (!existing) {
      rejected.push({ path: rawPath, reason: 'item inexistente' });
      continue;
    }

    target.collection.splice(target.index, 1);
    changes.push({
      op: 'remove',
      path: rawPath,
      label: `${target.ownerLabel} removido (posição ${target.index + 1})`,
      before: describeItem(existing, target.config),
      after: ''
    });
  }

  return { guide, changes, rejected };
};

const GUIDE_EDIT_CONTEXT_CHAR_LIMIT = 40_000;

/**
 * Inventário do roteiro usando exatamente a mesma sintaxe de caminho aceita por
 * `applyGuideOperations`, para o modelo referenciar o trecho certo.
 */
export const buildGuideEditContext = (guide: any) => {
  const lines: string[] = [];

  const pushField = (path: string, value: any) => {
    const text = normalizeText(value);
    if (text) lines.push(`${path}: ${text}`);
  };

  const pushCollection = (prefix: string, items: any[] | undefined, config: CollectionConfig) => {
    if (!Array.isArray(items) || !items.length) return;
    items.forEach((item, index) => {
      config.fields.forEach((field) => pushField(`${prefix}[${index}].${field}`, item?.[field]));
    });
  };

  for (const field of TOP_LEVEL_TEXT_FIELDS) {
    pushField(field, guide?.[field]);
  }

  pushCollection('coreConcepts', guide?.coreConcepts, ROOT_COLLECTIONS.coreConcepts);
  pushCollection('supportConcepts', guide?.supportConcepts, ROOT_COLLECTIONS.supportConcepts);
  pushCollection('checkpoints', guide?.checkpoints, ROOT_COLLECTIONS.checkpoints);

  const chapters = Array.isArray(guide?.bookChapters) ? guide.bookChapters : [];
  chapters.forEach((chapter: any, index: number) => {
    ROOT_COLLECTIONS.bookChapters.fields.forEach((field) =>
      pushField(`bookChapters[${index}].${field}`, chapter?.[field])
    );
    pushCollection(`bookChapters[${index}].coreConcepts`, chapter?.coreConcepts, CHAPTER_COLLECTIONS.coreConcepts);
    pushCollection(
      `bookChapters[${index}].supportConcepts`,
      chapter?.supportConcepts,
      CHAPTER_COLLECTIONS.supportConcepts
    );
  });

  const context = lines.join('\n').slice(0, GUIDE_EDIT_CONTEXT_CHAR_LIMIT).trim();
  return context || 'title: (roteiro vazio)';
};
