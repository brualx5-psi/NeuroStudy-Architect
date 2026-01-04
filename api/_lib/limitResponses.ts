import { ActionSuggestion, LimitReason } from './usageLimits.js';

const reasonMessages: Record<LimitReason, string> = {
  monthly_limit: 'Voce atingiu o limite mensal do seu plano.',
  monthly_tokens_exhausted: 'Voce atingiu o limite mensal de tokens do seu plano.',
  roadmap_too_large: 'Este estudo ficou grande demais. Divida em partes menores.',
  youtube_too_long: 'Este video excede o limite por video do seu plano.',
  too_many_sources: 'Seu plano permite menos fontes por roteiro.',
  chat_message_too_large: 'Divida a sua pergunta em partes menores para continuar.',
  web_search_limit: 'Voce atingiu o limite mensal de pesquisas web do seu plano.',
  rate_limited: 'Muitas requisicoes em pouco tempo. Tente novamente em instantes.'
};

const suggestionToActions = (suggestion?: ActionSuggestion) => {
  if (!suggestion) return [];
  if (suggestion === 'split_roadmap') return ['split_roadmap'];
  if (suggestion === 'remove_sources') return ['remove_sources'];
  if (suggestion === 'view_plans') return ['view_plans'];
  return [];
};

export const buildLimitResponse = (
  reason: LimitReason,
  suggestion?: ActionSuggestion
) => ({
  reason,
  message: reasonMessages[reason] || 'Limite atingido.',
  actions: suggestionToActions(suggestion)
});
