
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, PenTool } from './Icons';
import { ChatMessage, StudyGuide, StudySource } from '../types';
import { sendChatMessage, requestGuideEdit, isUsageLimitError, GuideEditProposal } from '../services/geminiService';
import { GuideChangePreview, GuideProposalStatus } from './GuideChangePreview';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction, LimitReason } from '../services/usageLimits';

interface ChatWidgetProps {
  studyId?: string;
  studyGuide: StudyGuide | null;
  sources?: StudySource[];
  onUsageLimit?: (reason: LimitReason) => void;
  /** Grava o roteiro editado. Só é chamado depois que o usuário aprova a proposta. */
  onApplyGuideEdit?: (updatedGuide: StudyGuide) => void;
}

/** Mensagem do chat que pode carregar uma proposta de edição aguardando aprovação. */
type ChatEntry = ChatMessage & { proposalId?: string };

type PendingProposal = {
  proposal: GuideEditProposal;
  status: GuideProposalStatus;
  /** Assinatura do roteiro que originou a proposta, para não sobrescrever edições mais novas. */
  baseSignature: string;
};

const CHAT_STORAGE_PREFIX = 'neurostudy:professor-chat';
const CHAT_MAX_STORED_MESSAGES = 40;
const CHAT_STORAGE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Heurística leve só para sugerir o modo de edição; nunca edita sozinha. */
const EDIT_INTENT_REGEX = /\b(mud(e|ar|a)|alter(e|ar|a)|troc(a|ar|e)|corrig(e|ir|a)|ajust(e|ar|a)|reescrev\w*|refa(ç|z)\w*|acrescent\w*|adicion\w*|inclu(a|ir)|remov\w*|apag(a|ar|ue)|delet\w*|renome\w*|encurt\w*|simplific\w*)\b/i;

const looksLikeEditRequest = (text: string) => EDIT_INTENT_REGEX.test(text || '');

const getInitialMessages = (studyGuide: StudyGuide | null): ChatEntry[] => {
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

const loadSavedChatState = (storageKey: string): { messages: ChatEntry[]; input: string } | null => {
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
      messages: parsed.messages.filter((msg: ChatEntry) => msg?.role && typeof msg.text === 'string').slice(-CHAT_MAX_STORED_MESSAGES),
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

const saveChatState = (storageKey: string, messages: ChatEntry[], input: string) => {
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

export const ChatWidget: React.FC<ChatWidgetProps> = ({ studyId, studyGuide, sources = [], onUsageLimit, onApplyGuideEdit }) => {
  const { planName, usage, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>(() => getInitialMessages(studyGuide));
  const [isEditMode, setIsEditMode] = useState(false);
  const [proposals, setProposals] = useState<Record<string, PendingProposal>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const skipNextSaveRef = useRef(false);
  const storageKey = getChatStorageKey(studyId, studyGuide);

  const canEditGuide = Boolean(studyGuide && onApplyGuideEdit);
  const guideSignature = useMemo(() => JSON.stringify(studyGuide || null), [studyGuide]);

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

  // Propostas pendentes pertencem ao roteiro em que nasceram: ao trocar de estudo elas somem.
  useEffect(() => {
    setProposals({});
  }, [storageKey]);

  useEffect(() => {
    if (!canEditGuide) setIsEditMode(false);
  }, [canEditGuide]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveChatState(storageKey, messages, input);
  }, [storageKey, messages, input]);

  const handleSend = async (textOverride?: string, forceEditMode?: boolean) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;
    const chatCheck = canPerformAction(planName, usage, [], 'chat', { textInput: textToSend, chatHistory: messages, isAdmin });
    if (!chatCheck.allowed) {
      onUsageLimit?.(chatCheck.reason || 'monthly_tokens_exhausted');
      return;
    }

    const shouldEdit = (forceEditMode ?? isEditMode) && canEditGuide;
    const userMsg: ChatEntry = { id: Date.now().toString(), role: 'user', text: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      if (shouldEdit) {
        const proposal = await requestGuideEdit(studyGuide as StudyGuide, textToSend, messages);
        const hasChanges = Boolean(proposal.guide && proposal.changes.length);
        const proposalId = `proposal-${Date.now()}`;

        if (hasChanges) {
          setProposals(prev => ({ ...prev, [proposalId]: { proposal, status: 'pending', baseSignature: guideSignature } }));
        }

        const botMsg: ChatEntry = {
          id: `${Date.now() + 1}`,
          role: 'model',
          text: proposal.reply || (hasChanges
            ? `Preparei ${proposal.changes.length} alteração(ões) no roteiro. Revise abaixo antes de salvar.`
            : 'Não encontrei o que alterar com esse pedido. Pode me dizer qual trecho do roteiro devo mudar?'),
          timestamp: Date.now(),
          proposalId: hasChanges ? proposalId : undefined
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        const responseText = await sendChatMessage(messages, textToSend, studyGuide, sources);
        const botMsg: ChatEntry = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: Date.now() };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (error) {
      const fallbackText = shouldEdit
        ? `Não consegui montar a alteração agora (${error instanceof Error ? error.message : 'erro no servidor'}). Seu roteiro segue intacto. Tente de novo ou edite à mão pelo botão "Editar" no roteiro.`
        : `Não consegui responder agora (${error instanceof Error ? error.message : 'erro no servidor'}). Tente reenviar a pergunta; se continuar, o problema é no backend/modelo, não no seu roteiro.`;

      const errorText = isUsageLimitError(error)
        ? 'Seu limite de chat foi atingido agora. Veja as opções do plano e tente de novo depois.'
        : fallbackText;

      if (isUsageLimitError(error)) {
        onUsageLimit?.(error.reason as LimitReason);
      } else {
        console.error(error);
      }

      const botMsg: ChatEntry = {
        id: `${Date.now()}-chat-error`,
        role: 'model',
        text: errorText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } finally { setIsLoading(false); }
  };

  /** Uma proposta gerada antes de outra edição não pode ser aplicada: ela desfaria a mais nova. */
  const resolveProposalStatus = (pending: PendingProposal): GuideProposalStatus =>
    pending.status === 'pending' && pending.baseSignature !== guideSignature ? 'outdated' : pending.status;

  const handleApproveProposal = (proposalId: string) => {
    const pending = proposals[proposalId];
    if (!pending || !pending.proposal.guide) return;

    if (resolveProposalStatus(pending) !== 'pending') {
      setProposals(prev => ({ ...prev, [proposalId]: { ...pending, status: 'outdated' } }));
      return;
    }

    onApplyGuideEdit?.(pending.proposal.guide);
    setProposals(prev => ({ ...prev, [proposalId]: { ...pending, status: 'approved' } }));
  };

  const handleDiscardProposal = (proposalId: string) => {
    const pending = proposals[proposalId];
    if (!pending || pending.status !== 'pending') return;
    setProposals(prev => ({ ...prev, [proposalId]: { ...pending, status: 'discarded' } }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const getSuggestions = () => {
    if (isEditMode && studyGuide) {
      const concept = studyGuide.coreConcepts?.[0]?.concept;
      return [
        'Deixe o objetivo da aula mais curto e direto',
        concept ? `Reescreva a definição de "${concept}" com linguagem simples` : 'Reescreva o primeiro conceito com linguagem simples',
        'Adicione um conceito sobre o que ficou faltando',
        'Remova o último checkpoint'
      ];
    }
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
      <div className={`p-4 flex justify-between items-center text-white shrink-0 transition-colors ${isEditMode ? 'bg-amber-600' : 'bg-indigo-600'}`}>
        <div className="flex items-center gap-2"><div className="bg-white/20 p-1.5 rounded-full"><Bot className="w-5 h-5" /></div><div><h3 className="font-bold text-sm">Professor Virtual</h3><p className={`text-xs ${isEditMode ? 'text-amber-100' : 'text-indigo-200'}`}>{isEditMode ? 'Editando o roteiro (com aprovação)' : 'Socrático & Ativo'}</p></div></div>
        <div className="flex items-center gap-1">
          {canEditGuide && (
            <button
              onClick={() => setIsEditMode(prev => !prev)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${isEditMode ? 'bg-white text-amber-700' : 'bg-white/15 text-white hover:bg-white/25'}`}
              title={isEditMode ? 'Voltar ao modo dúvidas' : 'Pedir alterações no roteiro'}
            >
              <PenTool className="w-3 h-3" /> {isEditMode ? 'Editando' : 'Editar roteiro'}
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors hover:bg-white/10 p-1 rounded-full"><X className="w-5 h-5" /></button>
        </div>
      </div>
      {isEditMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] text-amber-800 leading-snug shrink-0">
          Descreva a mudança que você quer. Eu monto a proposta e <strong>só salvo depois que você aprovar</strong>.
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => {
          const pending = msg.proposalId ? proposals[msg.proposalId] : undefined;

          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] space-y-2 ${pending ? 'w-full' : ''}`}>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>{renderFormattedText(msg.text)}</div>
                {pending && (
                  <GuideChangePreview
                    summary={pending.proposal.summary}
                    changes={pending.proposal.changes}
                    rejected={pending.proposal.rejected}
                    status={resolveProposalStatus(pending)}
                    onApprove={() => handleApproveProposal(msg.proposalId as string)}
                    onDiscard={() => handleDiscardProposal(msg.proposalId as string)}
                  />
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (<div className="flex justify-start"><div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1.5"><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span></div></div>)}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-white border-t border-gray-100 p-2 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-200">
        <div className="flex gap-2"><span className={`text-[10px] font-bold uppercase tracking-wider self-center mr-1 flex items-center gap-1 ${isEditMode ? 'text-amber-500' : 'text-indigo-400'}`}><Sparkles className="w-3 h-3" /> Sugestões:</span>{getSuggestions().map((suggestion, idx) => (<button key={idx} onClick={() => handleSend(suggestion)} disabled={isLoading} className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${isEditMode ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 hover:border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200'}`}>{suggestion}</button>))}</div>
      </div>
      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        {canEditGuide && !isEditMode && looksLikeEditRequest(input) && (
          <button
            type="button"
            onClick={() => { setIsEditMode(true); handleSend(input, true); }}
            disabled={isLoading}
            className="w-full mb-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <PenTool className="w-3.5 h-3.5" /> Parece um pedido de alteração — aplicar no roteiro (com aprovação)
          </button>
        )}
        <div className={`flex gap-2 items-center bg-gray-50 border rounded-full px-4 py-2 transition-shadow ${isEditMode ? 'border-amber-300 focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500' : 'border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500'}`}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={isEditMode ? 'O que devo mudar no roteiro?' : 'Tire suas dúvidas...'} className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm text-gray-800 placeholder:text-gray-400" disabled={isLoading} />
          <button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className={`disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1 ${isEditMode ? 'text-amber-600 hover:text-amber-700' : 'text-indigo-600 hover:text-indigo-700'}`}><Send className="w-5 h-5" /></button>
        </div>
        <div className="text-center mt-2"><span className="text-[10px] text-gray-400">{isEditMode ? 'Nenhuma alteração é salva sem a sua aprovação.' : 'O professor pode cometer erros. Verifique informações críticas.'}</span></div>
      </div>
    </div>
  );
};
