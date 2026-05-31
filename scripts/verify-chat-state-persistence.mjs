import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const widget = readFileSync(new URL('../client/src/components/ChatWidget.tsx', import.meta.url), 'utf8');

const checks = [
  [app, 'studyId={activeStudy?.id}', 'App não passa studyId ao ChatWidget'],
  [widget, 'studyId?: string;', 'ChatWidget não aceita studyId'],
  [widget, "CHAT_STORAGE_PREFIX = 'neurostudy:professor-chat'", 'ChatWidget não define chave de persistência'],
  [widget, 'CHAT_MAX_STORED_MESSAGES = 40', 'ChatWidget não limita histórico persistido'],
  [widget, 'CHAT_STORAGE_TTL_MS', 'ChatWidget não define expiração do histórico salvo'],
  [widget, 'getChatStorageKey(studyId, studyGuide)', 'ChatWidget não cria chave por estudo'],
  [widget, 'loadSavedChatState(storageKey)', 'ChatWidget não restaura conversa salva'],
  [widget, 'saveChatState(storageKey, messages, input)', 'ChatWidget não salva conversa/rascunho'],
  [widget, 'localStorage.getItem(storageKey)', 'ChatWidget não lê localStorage'],
  [widget, 'localStorage.setItem(storageKey', 'ChatWidget não grava localStorage'],
  [widget, 'skipNextSaveRef', 'ChatWidget não evita sobrescrever conversa salva ao trocar de estudo'],
  [widget, 'setInput(saved.input)', 'ChatWidget não restaura rascunho digitado'],
  [widget, '[storageKey]', 'ChatWidget ainda pode resetar por identidade do studyGuide em vez de por estudo']
];

for (const [content, snippet, message] of checks) {
  if (!content.includes(snippet)) {
    throw new Error(`${message}: ${snippet}`);
  }
}

if (widget.includes('useEffect(() => { if (studyGuide) setMessages')) {
  throw new Error('Reset antigo por mudança de studyGuide ainda existe');
}

console.log('Persistência do chat por estudo: OK');
