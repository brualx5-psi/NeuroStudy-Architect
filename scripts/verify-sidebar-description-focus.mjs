import { readFileSync } from 'node:fs';

const sidebar = readFileSync(new URL('../client/src/components/Sidebar.tsx', import.meta.url), 'utf8');

if (sidebar.includes('autoFocus')) {
  throw new Error('Sidebar não deve usar autoFocus nos campos de pasta; isso rouba foco do textarea de descrição ao re-renderizar.');
}

if (!sidebar.includes('Descrição curta do módulo (opcional)')) {
  throw new Error('Campo de descrição curta do módulo não encontrado na Sidebar.');
}

if (!sidebar.includes('MODULE_DESCRIPTION_MAX_LENGTH = 500') || !sidebar.includes('/{MODULE_DESCRIPTION_MAX_LENGTH}')) {
  throw new Error('Sidebar deve deixar claro o limite de 500 caracteres da descrição do módulo.');
}

if (!sidebar.includes('transcrição completa entra como fonte')) {
  throw new Error('Sidebar deve orientar que transcrição completa entra como fonte, não como descrição do módulo.');
}

if (sidebar.includes('<SectionHeader')) {
  throw new Error('SectionHeader não deve ser renderizado como componente JSX dentro da Sidebar; a função inline é recriada a cada render e remonta o formulário, perdendo foco.');
}

for (const rootId of ['root-neuro', 'root-books', 'root-pareto']) {
  if (!sidebar.includes(`renderSectionHeader({`) || !sidebar.includes(`rootId: '${rootId}'`)) {
    throw new Error(`renderSectionHeader deve ser chamado como função auxiliar para ${rootId}.`);
  }
}

console.log('Sidebar descrição de módulo sem roubo/perda de foco: OK');
