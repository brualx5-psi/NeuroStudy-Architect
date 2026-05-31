
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles } from './Icons';
import { ChatMessage, StudyGuide, StudySource } from '../types';
import { sendChatMessage, isUsageLimitError } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction, LimitReason } from '../services/usageLimits';

interface ChatWidgetProps {
  studyId?: string;
  studyGuide: StudyGuide | null;
  sources?: StudySource[];
  onUsageLimit?: (reason: LimitReason) => void;
}

const CHAT_STORAGE_PREFIX = 'neurostudy:professor-chat';
const CHAT_MAX_STORED_MESSAGES = 40;
const CHAT_STORAGE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const getInitialMessages = (studyGuide: StudyGuide | null): ChatMessage[] => {
  if (studyGuide) {
    return [{
      id: 'new-topic',
      role: 'model',
      text: `Olá! Vejo que você gerou um roteiro sobre "${studyGuide.subject}". Como posso ajudar a aprofundar esse tema?`,
      timestamp: Date.now()
    }];
  }

  return [{
    id: 'welcome',
    role: 'model',
    text: 'Olá! Sou seu professor virtual. Tem alguma dúvida sobre o roteiro de estudos ou sobre o conteúdo?',
    timestamp: Date.now()
  }];
};

const getChatStorageKey = (studyId: string | undefined, studyGuide: StudyGuide | null) => {
  const rawKey = studyId || studyGuide?.title || studyGuide?.subject || 'global';
  return `${CHAT_STORAGE_PREFIX}:${rawKey}`;
};

const loadSavedChatState = (storageKey: string): { messages: ChatMessage[]; input: string } | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.messages)) return null;

    const updatedAt = Number(parsed?.updatedAt || 0);
    if (updatedAt && Date.now() - updatedAt > CHAT_STORAGE_TTL_MS) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return {
      messages: parsed.messages.filter((msg: ChatMessage) => msg?.role && typeof msg.text === 'string').slice(-CHAT_MAX_STORED_MESSAGES),
      input: typeof parsed.input === 'string' ? parsed.input : ''
    };
  } catch (error) {
    console.warn('[ChatWidget] Não consegui restaurar conversa salva:', error);
    return null;
  }
};

const cleanupExpiredChatStates = () => {
  try {
    const now = Date.now();
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${CHAT_STORAGE_PREFIX}:`)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const updatedAt = Number(parsed?.updatedAt || 0);
      if (updatedAt && now - updatedAt > CHAT_STORAGE_TTL_MS) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('[ChatWidget] Não consegui limpar conversas expiradas:', error);
  }
};

const saveChatState = (storageKey: string, messages: ChatMessage[], input: string) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      messages: messages.slice(-CHAT_MAX_STORED_MESSAGES),
      input,
      updatedAt: Date.now()
    }));
  } catch (error) {
    console.warn('[ChatWidget] Não consegui salvar conversa:', error);
  }
};

export const ChatWidget: React.FC<ChatWidgetProps> = ({ studyId, studyGuide, sources = [], onUsageLimit }) => {
  const { planName, usage, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(studyGuide));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const skipNextSaveRef = useRef(false);
  const storageKey = getChatStorageKey(studyId, studyGuide);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages, isOpen]);
  useEffect(() => { cleanupExpiredChatStates(); }, []);

  useEffect(() => {
    skipNextSaveRef.current = true;
    const saved = loadSavedChatState(storageKey);
    if (saved) {
      setMessages(saved.messages.length ? saved.messages : getInitialMessages(studyGuide));
      setInput(saved.input);
      return;
    }
    setMessages(getInitialMessages(studyGuide));
    setInput('');
  }, [storageKey]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveChatState(storageKey, messages, input);
  }, [storageKey, messages, input]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;
    const chatCheck = canPerformAction(planName, usage, [], 'chat', { textInput: textToSend, chatHistory: messages, isAdmin });
    if (!chatCheck.allowed) {
      onUsageLimit?.(chatCheck.reason || 'monthly_tokens_exhausted');
      return;
    }
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const responseText = await sendChatMessage(messages, textToSend, studyGuide, sources);
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      if (isUsageLimitError(error)) {
        onUsageLimit?.(error.reason as LimitReason);
      } else {
        console.error(error);
      }
    } finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const getSuggestions = () => {
    if (!studyGuide) return ["Como combater a procrastinação?", "O que é Repetição Espaçada?", "Como melhorar meu foco?", "Técnica Pomodoro funciona?"];
    const concept1 = studyGuide.coreConcepts[0]?.concept || "o tema principal";
    const concept2 = studyGuide.coreConcepts[1]?.concept;
    const suggestions = [`Me explique "${concept1}" com exemplos`, "Faça um teste rápido sobre isso", "Como aplicar isso na prática?", "Quais as conexões com outros temas?", "Resuma os pontos principais"];
    if (concept2) suggestions.splice(1, 0, `Qual a diferença entre ${concept1} e ${concept2}?`);
    return suggestions;
  };

  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <p key={i} className="mb-1 last:mb-0 min-h-[1rem]">{line.split(/(\*\*.*?\*\*)/g).map((part, j) => { if (part.startsWith('**') && part.endsWith('**')) return <strong key={j}>{part.slice(2, -2)}</strong>; return <span key={j}>{part}</span>; })}</p>
    ));
  };

  if (!isOpen) return (<button onClick={() => setIsOpen(true)} className="fixed bottom-32 md:bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center z-50 print:hidden animate-bounce-subtle" title="Falar com Professor Virtual"><MessageCircle className="w-8 h-8" /></button>);

  return (
    <div className="fixed bottom-32 md:bottom-6 right-6 w-96 h-[600px] max-h-[50vh] md:max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden font-sans print:hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-2"><div className="bg-white/20 p-1.5 rounded-full"><Bot className="w-5 h-5" /></div><div><h3 className="font-bold text-sm">Professor Virtual</h3><p className="text-xs text-indigo-200">Socrático & Ativo</p></div></div>
        <button onClick={() => setIsOpen(false)} className="text-indigo-100 hover:text-white transition-colors hover:bg-white/10 p-1 rounded-full"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (<div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>{renderFormattedText(msg.text)}</div></div>))}
        {isLoading && (<div className="flex justify-start"><div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1.5"><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span></div></div>)}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-white border-t border-gray-100 p-2 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-200">
        <div className="flex gap-2"><span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider self-center mr-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Sugestões:</span>{getSuggestions().map((suggestion, idx) => (<button key={idx} onClick={() => handleSend(suggestion)} disabled={isLoading} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors disabled:opacity-50">{suggestion}</button>))}</div>
      </div>
      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        <div className="flex gap-2 items-center bg-gray-50 border border-gray-300 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Tire suas dúvidas..." className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm text-gray-800 placeholder:text-gray-400" disabled={isLoading} />
          <button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="text-indigo-600 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"><Send className="w-5 h-5" /></button>
        </div>
        <div className="text-center mt-2"><span className="text-[10px] text-gray-400">O professor pode cometer erros. Verifique informações críticas.</span></div>
      </div>
    </div>
  );
};
