import { readFileSync } from 'node:fs';

const sidebar = readFileSync(new URL('../client/src/components/Sidebar.tsx', import.meta.url), 'utf8');

if (sidebar.includes('autoFocus')) {
  throw new Error('Sidebar não deve usar autoFocus nos campos de pasta; isso rouba foco do textarea de descrição ao re-renderizar.');
}

if (!sidebar.includes('Descrição do módulo (opcional)')) {
  throw new Error('Campo de descrição do módulo não encontrado na Sidebar.');
}

console.log('Sidebar descrição de módulo sem roubo de foco: OK');
