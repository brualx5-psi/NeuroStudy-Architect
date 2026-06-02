import fs from 'node:fs';

const app = fs.readFileSync('client/src/App.tsx', 'utf8');

const checks = [
  {
    name: 'modo livro sem roteiro renderiza uma área clara de upload',
    pass: app.includes('Subir livro') &&
      app.includes('Envie o PDF, EPUB ou MOBI antes de gerar o resumo do livro.') &&
      app.includes('Clique ou arraste o livro aqui')
  },
  {
    name: 'upload do livro aceita formatos de livro e força fluxo de arquivo/PDF',
    pass: app.includes('accept=".pdf,.epub,.mobi"') &&
      app.includes('onChange={(e) => { setInputType(InputType.PDF); setSelectedFile(e.target.files?.[0] || null); }}')
  },
  {
    name: 'livro selecionado pode ser adicionado à lista antes de gerar',
    pass: app.includes('Adicionar livro à lista') &&
      app.includes('disabled={!selectedFile}') &&
      app.includes('onClick={() => addSourceToStudy()}')
  },
  {
    name: 'geração do resumo do livro fica bloqueada enquanto não houver fonte',
    pass: app.includes('disabled={activeStudy.sources.length === 0}') &&
      app.includes("activeStudy.sources.length > 0 ? 'Gerar Resumo do Livro' : 'Suba o livro para gerar'")
  },
  {
    name: 'fontes carregadas aparecem no próprio modo livro',
    pass: app.includes('Fonte do livro') &&
      app.includes('fonte{activeStudy.sources.length > 1 ?') &&
      app.includes('removeSource(source.id)')
  }
];

const failed = checks.filter(check => !check.pass);
if (failed.length) {
  console.error('Falhas na verificação de upload no modo livro:');
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log('OK: modo livro mostra upload, lista fontes e só gera após o livro ser adicionado.');
