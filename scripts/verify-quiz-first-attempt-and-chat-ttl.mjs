import fs from 'node:fs';

const quizView = fs.readFileSync('client/src/components/QuizView.tsx', 'utf8');
const chatWidget = fs.readFileSync('client/src/components/ChatWidget.tsx', 'utf8');

const mustContain = [
  [quizView, 'firstAttemptResults', 'Quiz precisa guardar resultado da primeira tentativa'],
  [quizView, 'recordFirstAttempt', 'Quiz precisa registrar a primeira tentativa uma única vez'],
  [quizView, 'prev[questionId] ? prev', 'Registro da primeira tentativa não pode ser sobrescrito por retry'],
  [quizView, 'nota da 1ª tentativa', 'Resultado precisa deixar claro que a nota é da primeira tentativa'],
  [quizView, 'Tentar novamente como treino', 'Retry deve ser treino pós-resultado'],
  [quizView, 'Você poderá refazer esta questão depois do resultado final.', 'Retry precisa ficar bloqueado antes do resultado final'],
  [quizView, 'A pontuação fica travada na primeira resposta', 'Resultado precisa explicar que retry não altera nota'],
  [quizView, "performanceStats?.isComplete && firstAttempt", 'Retry deve depender do quiz completo'],
  [chatWidget, 'CHAT_STORAGE_TTL_MS', 'Chat precisa ter TTL para não crescer indefinidamente'],
  [chatWidget, 'CHAT_MAX_STORED_MESSAGES = 40', 'Chat precisa limitar histórico salvo a 40 mensagens'],
  [chatWidget, 'cleanupExpiredChatStates', 'Chat precisa limpar conversas expiradas'],
  [chatWidget, 'localStorage.removeItem(storageKey)', 'Chat expirado precisa ser removido ao carregar']
];

const missing = mustContain.filter(([content, needle]) => !content.includes(needle));
if (missing.length) {
  console.error('Falhas de verificação:');
  for (const [, needle, message] of missing) console.error(`- ${message}: não encontrei "${needle}"`);
  process.exit(1);
}

if (/!isUserCorrect\(q\.id\).*Tentar Novamente/.test(quizView)) {
  console.error('Retry imediato antigo ainda parece existir.');
  process.exit(1);
}

console.log('OK: quiz usa primeira tentativa para a nota, libera retry só pós-resultado e chat tem TTL/limite.');
