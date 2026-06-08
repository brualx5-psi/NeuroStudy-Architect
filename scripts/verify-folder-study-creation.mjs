import fs from 'node:fs';

const sidebar = fs.readFileSync('client/src/components/Sidebar.tsx', 'utf8');
const app = fs.readFileSync('client/src/App.tsx', 'utf8');

const studyRenderCount = (sidebar.match(/\{filteredStudies\.map\(study => \(/g) || []).length;

const checks = [
  {
    name: 'Sidebar renderiza cada lista de estudos uma única vez por nível da árvore',
    pass: studyRenderCount === 1
  },
  {
    name: 'Sidebar tem ação direta para criar estudo dentro de uma pasta',
    pass: sidebar.includes('handleCreateStudyInFolder') &&
      sidebar.includes('onRequestNewStudy(folderId)') &&
      sidebar.includes('setExpandedFolders(prev => ({ ...prev, [folderId]: true }))')
  },
  {
    name: 'Linha da pasta mostra botão explícito Novo estudo nesta pasta',
    pass: sidebar.includes('title="Novo estudo nesta pasta"') &&
      sidebar.includes('aria-label={`Novo estudo em ${folder.name}`}') &&
      sidebar.includes('handleCreateStudyInFolder(folder.id)')
  },
  {
    name: 'Botão + continua sendo subpasta, separado do novo estudo',
    pass: sidebar.includes('title="Nova subpasta"') &&
      sidebar.includes('setCreatingSubfolderIn(folder.id)')
  },
  {
    name: 'App cria/reutiliza estudo vazio usando o folderId solicitado',
    pass: app.includes('const handleRequestNewStudy = (folderId: string)') &&
      app.includes('setTargetFolderId(folderId)') &&
      app.includes('s.folderId === folderId') &&
      app.includes('createStudy(\n                folderId,')
  }
];

const failed = checks.filter(check => !check.pass);
if (failed.length) {
  console.error('Falhas na verificação de criação de estudo dentro da pasta:');
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log('OK: pastas têm ação direta para criar estudo dentro delas, separada de nova subpasta.');
