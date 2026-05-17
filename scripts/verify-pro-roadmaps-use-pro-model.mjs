#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const gemini = readFileSync('api/_lib/gemini.ts', 'utf8');

const required = [
  "if (taskType === 'studyGuide') return MODEL_PRO;",
  "if (options.planName === 'free' && model === MODEL_PRO) {",
  'model = MODEL_FLASH;',
];

const forbidden = [
  "if (taskType === 'studyGuide' || taskType === 'slides') {\n    if (isBook || contentLength > 50000 || sourceCount >= 3) {\n      return MODEL_PRO;\n    }\n  }",
];

const missing = required.filter((snippet) => !gemini.includes(snippet));
const foundForbidden = forbidden.filter((snippet) => gemini.includes(snippet));

if (missing.length || foundForbidden.length) {
  console.error('Falha: roteiros Pro ainda nao estao forçados para MODEL_PRO.');
  if (missing.length) {
    console.error('\nTrechos obrigatórios ausentes:');
    for (const item of missing) console.error(`- ${item}`);
  }
  if (foundForbidden.length) {
    console.error('\nTrechos antigos ainda presentes:');
    for (const item of foundForbidden) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log('OK: studyGuide seleciona MODEL_PRO; plano free ainda faz downgrade para Flash.');
