import React from 'react';
import { createPortal } from 'react-dom';
import { X } from './Icons';
import { LimitReason } from '../services/usageLimits';

interface UsageLimitModalProps {
  isOpen: boolean;
  reason: LimitReason | null;
  onClose: () => void;
  onViewPlans?: () => void;
  onSplitRoadmap?: () => void;
  onRemoveSources?: () => void;
}

const getContentForReason = (reason: LimitReason | null) => {
  switch (reason) {
    case 'roadmap_too_large':
      return {
        title: '📚 Este estudo ficou grande demais.',
        message: 'Divida em 2 roteiros para manter qualidade e velocidade.',
        actions: ['split', 'remove', 'close'],
        closeLabel: 'Entendi'
      };
    case 'monthly_limit':
      return {
        title: 'Limite mensal atingido',
        message: 'Você atingiu o limite mensal do seu plano.',
        actions: ['plans', 'close'],
        closeLabel: 'Ok'
      };
    case 'monthly_tokens_exhausted':
      return {
        title: 'Limite de créditos atingido',
        message: 'Você atingiu o limite mensal de créditos do seu plano.',
        actions: ['plans', 'close'],
        closeLabel: 'Ok'
      };
    case 'youtube_too_long':
      return {
        title: 'Vídeo muito longo',
        message: 'Este vídeo excede o limite por vídeo do seu plano. Use um trecho menor ou divida em partes.',
        actions: ['close'],
        closeLabel: 'Entendi'
      };
    case 'too_many_sources':
      return {
        title: 'Limite de fontes atingido',
        message: 'Seu plano permite menos fontes por roteiro.',
        actions: ['remove', 'plans', 'close'],
        closeLabel: 'Entendi'
      };
    case 'chat_message_too_large':
      return {
        title: 'Mensagem muito longa',
        message: 'Divida a sua pergunta em partes menores para continuar.',
        actions: ['close'],
        closeLabel: 'Entendi'
      };
    case 'web_search_limit':
      return {
        title: 'Limite de pesquisa web atingido',
        message: 'Você atingiu o limite mensal de pesquisas web do seu plano.',
        actions: ['plans', 'close'],
        closeLabel: 'Ok'
      };
    case 'rate_limited':
      return {
        title: 'Muitas requisicoes',
        message: 'Voce esta fazendo muitas acoes em pouco tempo. Aguarde alguns segundos e tente novamente.',
        actions: ['close'],
        closeLabel: 'Ok'
      };
    default:
      return {
        title: 'Limite atingido',
        message: 'Você atingiu um limite do seu plano.',
        actions: ['close'],
        closeLabel: 'Ok'
      };
  }
};

export const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
  isOpen,
  reason,
  onClose,
  onViewPlans,
  onSplitRoadmap,
  onRemoveSources
}) => {
  if (!isOpen) return null;
  const content = getContentForReason(reason);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="p-8 space-y-4">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{content.title}</h3>
            <p className="text-slate-600 mt-2">{content.message}</p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            {content.actions.includes('split') && (
              <button
                onClick={() => onSplitRoadmap?.()}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
              >
                Dividir automaticamente
              </button>
            )}
            {content.actions.includes('remove') && (
              <button
                onClick={() => onRemoveSources?.()}
                className="px-5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
              >
                Remover fontes
              </button>
            )}
            {content.actions.includes('plans') && (
              <button
                onClick={() => onViewPlans?.()}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Ver planos
              </button>
            )}
            {content.actions.includes('close') && (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                {content.closeLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
