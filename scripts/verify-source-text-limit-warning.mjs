import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const gemini = readFileSync(new URL('../api/_lib/gemini.ts', import.meta.url), 'utf8');

if (!app.includes('PRIMARY_SOURCE_CONTEXT_CHAR_LIMIT = 100_000')) {
  throw new Error('App deve declarar o limite de contexto da fonte principal usado pelo servidor.');
}

if (!app.includes('getPrimarySourceContextLength') || !app.includes("source.textContent || source.content || ''")) {
  throw new Error('App deve medir o mesmo texto que o servidor usa para fatiar a fonte principal.');
}

if (!app.includes('primarySourceLength > PRIMARY_SOURCE_CONTEXT_CHAR_LIMIT')) {
  throw new Error('App deve avisar antes de gerar roteiro com fonte principal acima do limite direto.');
}

if (!app.includes('Para não perder o final da fala do professor')) {
  throw new Error('Aviso deve explicar que o final da fala pode ficar de fora e sugerir divisão.');
}

if (!gemini.includes('primaryText.slice(0, 100000)')) {
  throw new Error('Verificação desatualizada: o limite do servidor mudou; atualize o aviso do cliente.');
}

console.log('Aviso de limite/truncamento de fonte principal: OK');
