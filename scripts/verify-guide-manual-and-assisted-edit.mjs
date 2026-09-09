/**
 * Verifica as duas formas de editar o roteiro:
 * 1) edição manual pelo próprio usuário (botão "Editar" -> GuideEditor);
 * 2) edição pedida ao Professor Virtual, que só grava após aprovação explícita.
 *
 * Além das checagens de fiação, roda o motor de patch de verdade.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const resultsView = read('client/src/components/ResultsView.tsx');
const guideEditor = read('client/src/components/GuideEditor.tsx');
const chatWidget = read('client/src/components/ChatWidget.tsx');
const changePreview = read('client/src/components/GuideChangePreview.tsx');
const app = read('client/src/App.tsx');
const geminiService = read('client/src/services/geminiService.ts');
const aiRouter = read('api/ai.ts');
const guideEditHandler = read('api/_handlers/ai/guide-edit.ts');
const guideEditSource = read('api/_lib/guideEdit.ts');
const gemini = read('api/_lib/gemini.ts');

const checks = [
  // 1. Edição manual
  [resultsView, "import { GuideEditor } from './GuideEditor'", 'ResultsView não usa o editor manual'],
  [resultsView, 'setIsEditingGuide(true)', 'ResultsView não tem botão para abrir a edição manual'],
  [resultsView, 'onUpdateGuide(updatedGuide)', 'ResultsView não persiste o roteiro editado à mão'],
  [guideEditor, 'onSave: (updatedGuide: StudyGuide) => void', 'GuideEditor não expõe callback de salvar'],
  [guideEditor, 'Salvar alterações', 'GuideEditor não tem botão de salvar'],
  [guideEditor, 'Adicionar conceito', 'GuideEditor não permite adicionar conceitos'],
  [guideEditor, 'Adicionar checkpoint', 'GuideEditor não permite adicionar checkpoints'],

  // 2. Edição assistida com aprovação
  [app, 'onApplyGuideEdit={activeStudy', 'App não liga o chat ao salvamento do roteiro'],
  [chatWidget, 'onApplyGuideEdit?: (updatedGuide: StudyGuide) => void', 'ChatWidget não aceita o callback de gravação'],
  [chatWidget, 'requestGuideEdit(studyGuide as StudyGuide, textToSend, messages)', 'ChatWidget não pede a proposta de edição'],
  [chatWidget, 'handleApproveProposal', 'ChatWidget não tem aprovação de proposta'],
  [chatWidget, 'handleDiscardProposal', 'ChatWidget não permite descartar a proposta'],
  [changePreview, 'Aprovar e salvar', 'Pré-visualização sem botão de aprovar'],
  [changePreview, 'Descartar', 'Pré-visualização sem botão de descartar'],
  [changePreview, 'nada foi salvo ainda', 'Pré-visualização não deixa claro que nada foi salvo'],
  [chatWidget, 'baseSignature', 'ChatWidget não guarda a versão do roteiro que originou a proposta'],
  [chatWidget, 'resolveProposalStatus', 'ChatWidget não invalida propostas geradas antes de outra edição'],
  [geminiService, "'/api/ai?action=guide-edit'", 'Serviço não chama o endpoint de edição'],
  [aiRouter, "'guide-edit': guideEditHandler", 'Rota guide-edit não registrada'],
  [guideEditHandler, 'applyGuideOperations(body.guide, operations)', 'Handler não aplica as operações propostas'],
  [gemini, 'export const proposeGuideEdit', 'gemini.ts não expõe proposeGuideEdit']
];

for (const [content, snippet, message] of checks) {
  if (!content.includes(snippet)) {
    throw new Error(`${message}: ${snippet}`);
  }
}

// A gravação só pode acontecer dentro do handler de aprovação.
const approveBlock = chatWidget.slice(chatWidget.indexOf('const handleApproveProposal'));
assert.ok(
  approveBlock.slice(0, approveBlock.indexOf('const handleDiscardProposal')).includes('onApplyGuideEdit?.('),
  'A aprovação não grava o roteiro proposto'
);
assert.equal(
  chatWidget.split('onApplyGuideEdit?.(').length - 1,
  1,
  'O roteiro está sendo gravado fora do fluxo de aprovação'
);
assert.ok(
  guideEditHandler.includes('guide: changes.length ? guide : null'),
  'Handler devolve roteiro proposto mesmo sem mudanças'
);

// === Motor de patch: comportamento real ===
const { code } = transformSync(guideEditSource, { loader: 'ts', format: 'esm' });
const { applyGuideOperations, buildGuideEditContext } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const guide = {
  title: 'Aula 1',
  overview: 'Objetivo original',
  coreConcepts: [{ concept: 'Sinapse', definition: 'Def antiga' }],
  checkpoints: [
    { id: 'cp1', title: 'CP um', mission: 'M1', timestamp: '00:01', lookFor: 'L1', noteExactly: 'N1', drawExactly: 'D1', question: 'Q1', completed: true }
  ],
  quiz: [{ id: 'q1', question: 'original' }]
};
const snapshot = JSON.stringify(guide);

const edited = applyGuideOperations(guide, [
  { op: 'set', path: 'overview', value: 'Objetivo novo' },
  { op: 'set', path: 'coreConcepts[0].definition', value: 'Def nova' },
  { op: 'insert', path: 'checkpoints[1]', fields: [
    { key: 'title', value: 'CP novo' },
    { key: 'mission', value: 'Missao' },
    { key: 'lookFor', value: 'Olhe' },
    { key: 'noteExactly', value: 'Anote' }
  ] }
]);

assert.equal(edited.changes.length, 3, 'as três operações válidas deveriam ser aplicadas');
assert.equal(edited.guide.overview, 'Objetivo novo');
assert.equal(edited.changes[0].before, 'Objetivo original', 'a mudança precisa mostrar o texto anterior');
assert.equal(edited.guide.checkpoints.length, 2);
assert.ok(edited.guide.checkpoints[1].id, 'checkpoint inserido precisa de id');
assert.equal(edited.guide.checkpoints[0].completed, true, 'progresso do aluno não pode se perder na edição');
assert.equal(JSON.stringify(guide), snapshot, 'o roteiro original não pode ser mutado antes da aprovação');

const blocked = applyGuideOperations(guide, [
  { op: 'set', path: 'quiz[0].question', value: 'nao permitido' },
  { op: 'set', path: '__proto__.polluted', value: 'x' },
  { op: 'set', path: 'coreConcepts[99].definition', value: 'inexistente' },
  { op: 'insert', path: 'coreConcepts[0]', fields: [{ key: 'concept', value: 'sem definicao' }] },
  { op: 'remove', path: 'overview' }
]);

assert.equal(blocked.changes.length, 0, 'operações fora do contrato não podem ser aplicadas');
assert.equal(blocked.rejected.length, 5, 'operações inválidas precisam ser reportadas');
assert.equal({}.polluted, undefined, 'prototype pollution');

const inventory = buildGuideEditContext(guide);
assert.ok(inventory.includes('coreConcepts[0].definition: Def antiga'), 'inventário sem caminho de conceito');
assert.ok(!inventory.includes('quiz'), 'inventário não deve expor campos não editáveis');

console.log('Edição do roteiro (manual + assistida com aprovação): OK');
