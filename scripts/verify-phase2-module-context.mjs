import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assertIncludes = (content, expected, label) => {
  if (!content.includes(expected)) {
    throw new Error(`${label}: trecho esperado não encontrado: ${expected}`);
  }
};

const app = read('client/src/App.tsx');
const sidebar = read('client/src/components/Sidebar.tsx');
const clientTypes = read('client/src/types.ts');
const rootTypes = read('types.ts');
const service = read('client/src/services/geminiService.ts');
const roadmap = read('api/_handlers/ai/roadmap.ts');
const gemini = read('api/_lib/gemini.ts');

assertIncludes(clientTypes, 'description?: string', 'Folder do client deve aceitar descrição opcional');
assertIncludes(rootTypes, 'description?: string', 'Folder raiz deve aceitar descrição opcional');
assertIncludes(sidebar, 'Descrição do módulo (opcional)', 'Sidebar deve permitir descrição/contexto do módulo');
assertIncludes(sidebar, 'onRenameFolder(editingFolderId, editName.trim(), editDescription)', 'Edição deve permitir limpar descrição existente');
assertIncludes(app, 'getFolderModuleContext', 'App deve ter helper para buscar contexto da pasta ativa');
assertIncludes(app, 'current = current.parentId ? foldersById.get(current.parentId) : undefined', 'App deve herdar contexto de pastas-pai');
assertIncludes(app, '.flatMap(folder =>', 'App deve priorizar a pasta atual antes das pastas-pai no contexto herdado');
assertIncludes(app, 'handleGenerateGuideForStudy(newStudy.id, [newSource], mode, isBook, folderContext)', 'AutoGenerate deve passar contexto da pasta');
assertIncludes(service, 'moduleContext?: string', 'Serviço client deve aceitar moduleContext opcional');
assertIncludes(service, 'body.moduleContext = trimmedContext', 'Serviço client deve enviar moduleContext quando existir');
assertIncludes(roadmap, 'moduleContext?: string', 'Handler roadmap deve tipar moduleContext');
assertIncludes(roadmap, 'rawModuleContext.slice(0, 500)', 'Handler roadmap deve limitar contexto do módulo');
assertIncludes(gemini, 'CONTEXTO DO MODULO/PASTA', 'Prompt deve injetar contexto do módulo/pasta');
assertIncludes(gemini, 'JSON.stringify(sanitizedModuleContext)', 'Prompt deve escapar contexto do módulo com segurança');
assertIncludes(gemini, 'A Fonte Principal continua mandando no conteudo', 'Prompt deve preservar prioridade da fonte principal');
assertIncludes(gemini, 'Nao invente fatos', 'Prompt deve ter guardrail anti-invenção');
assertIncludes(gemini, 'sinalize isso de forma transparente no "Objetivo da aula"', 'Prompt deve sinalizar desalinhamento no Objetivo da aula');

console.log('Fase 2 contexto de módulo/pasta: OK');
