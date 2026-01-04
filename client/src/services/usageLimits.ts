import { ChatMessage, InputType, StudySource } from '../types';
import { PLAN_LIMITS, PlanName, TokenTaskType } from '../config/planLimits';
import { estimateTextFromBinary, extractTextFromPdfBase64 } from './textExtraction';

export type LimitReason =
  | 'monthly_limit'
  | 'monthly_tokens_exhausted'
  | 'roadmap_too_large'
  | 'youtube_too_long'
  | 'too_many_sources'
  | 'chat_message_too_large'
  | 'web_search_limit'
  | 'rate_limited';

export type ActionSuggestion = 'split_roadmap' | 'remove_sources' | 'view_plans';

export type ActionTaskType = TokenTaskType | 'web_search' | 'youtube';

export type UsageSnapshot = {
  roadmaps_created: number;
  youtube_minutes_used: number;
  web_research_used: number;
  chat_messages: number;
  monthly_tokens_used: number;
  chat_tokens_used: number;
};

type ActionCheck = {
  allowed: boolean;
  reason?: LimitReason;
  actionSuggestion?: ActionSuggestion;
  estimatedTokens?: number;
};

const normalizeUsage = (usage?: Partial<UsageSnapshot> | null): UsageSnapshot => ({
  roadmaps_created: usage?.roadmaps_created ?? 0,
  youtube_minutes_used: usage?.youtube_minutes_used ?? 0,
  web_research_used: usage?.web_research_used ?? 0,
  chat_messages: usage?.chat_messages ?? 0,
  monthly_tokens_used: usage?.monthly_tokens_used ?? 0,
  chat_tokens_used: usage?.chat_tokens_used ?? 0
});

const getSourceText = (source: StudySource) => {
  if (source.textContent) return source.textContent;
  if (source.type === InputType.PDF) return extractTextFromPdfBase64(source.content);
  if (source.type === InputType.EPUB || source.type === InputType.MOBI) return estimateTextFromBinary(source.content);
  return source.content || '';
};

const estimateTokens = (chars: number, planName: PlanName, taskType: TokenTaskType) => {
  const inputTokens = Math.ceil(chars / 4);
  const outputTokens = PLAN_LIMITS[planName].max_output_tokens[taskType] || 0;
  return inputTokens + outputTokens;
};

export const estimateTokensFromSources = (
  sources: StudySource[],
  taskType: TokenTaskType,
  planName: PlanName = 'free'
) => {
  const totalChars = sources.reduce((sum, source) => sum + getSourceText(source).length, 0);
  return estimateTokens(totalChars, planName, taskType);
};

export const estimateTokensFromText = (
  text: string,
  taskType: TokenTaskType,
  planName: PlanName = 'free'
) => estimateTokens(text.length, planName, taskType);

export const estimateTokensFromChat = (
  history: ChatMessage[],
  message: string,
  planName: PlanName = 'free'
) => {
  const recent = history.slice(-5);
  const combinedText = [...recent.map((msg) => msg.text), message].join('\n');
  return estimateTokensFromText(combinedText, 'chat', planName);
};

export const canPerformAction = (
  planName: PlanName,
  usage: Partial<UsageSnapshot> | null,
  sources: StudySource[],
  taskType: ActionTaskType,
  options?: {
    textInput?: string;
    chatHistory?: ChatMessage[];
    youtubeMinutes?: number;
  }
): ActionCheck => {
  const limits = PLAN_LIMITS[planName];
  const usageSnapshot = normalizeUsage(usage);

  if (taskType === 'web_search') {
    if (usageSnapshot.web_research_used >= limits.web_research) {
      return { allowed: false, reason: 'web_search_limit', actionSuggestion: 'view_plans' };
    }
    return { allowed: true };
  }

  if (taskType === 'youtube') {
    const minutes = options?.youtubeMinutes ?? 0;
    if (minutes > limits.youtube_minutes_per_video) {
      return { allowed: false, reason: 'youtube_too_long' };
    }
    if (usageSnapshot.youtube_minutes_used + minutes > limits.youtube_minutes) {
      return { allowed: false, reason: 'monthly_limit', actionSuggestion: 'view_plans' };
    }
    return { allowed: true };
  }

  if (taskType === 'roadmap') {
    if (usageSnapshot.roadmaps_created >= limits.roadmaps) {
      return { allowed: false, reason: 'monthly_limit', actionSuggestion: 'view_plans' };
    }
    if (sources.length > limits.sources_per_study) {
      return { allowed: false, reason: 'too_many_sources', actionSuggestion: 'remove_sources' };
    }
    const estimatedTokens = estimateTokensFromSources(sources, 'roadmap', planName);
    if (estimatedTokens > limits.max_tokens_per_roadmap) {
      return { allowed: false, reason: 'roadmap_too_large', actionSuggestion: 'split_roadmap', estimatedTokens };
    }
    if (usageSnapshot.monthly_tokens_used + estimatedTokens > limits.monthly_tokens) {
      return { allowed: false, reason: 'monthly_tokens_exhausted', actionSuggestion: 'view_plans', estimatedTokens };
    }
    return { allowed: true, estimatedTokens };
  }

  if (taskType === 'chat') {
    const message = options?.textInput || '';
    const estimatedTokens = estimateTokensFromChat(options?.chatHistory || [], message, planName);

    if (estimatedTokens > limits.max_tokens_per_chat_message) {
      return { allowed: false, reason: 'chat_message_too_large', estimatedTokens };
    }

    const chatMonthlyTokens = limits.chat_messages * limits.max_tokens_per_chat_message;
    if (usageSnapshot.chat_tokens_used + estimatedTokens > chatMonthlyTokens) {
      return { allowed: false, reason: 'monthly_tokens_exhausted', actionSuggestion: 'view_plans', estimatedTokens };
    }

    if (usageSnapshot.monthly_tokens_used + estimatedTokens > limits.monthly_tokens) {
      return { allowed: false, reason: 'monthly_tokens_exhausted', actionSuggestion: 'view_plans', estimatedTokens };
    }

    return { allowed: true, estimatedTokens };
  }

  if (taskType === 'quiz' || taskType === 'flashcards') {
    const inputText = options?.textInput || sources.map(getSourceText).join('\n');
    const estimatedTokens = estimateTokensFromText(inputText, taskType, planName);
    if (usageSnapshot.monthly_tokens_used + estimatedTokens > limits.monthly_tokens) {
      return { allowed: false, reason: 'monthly_tokens_exhausted', actionSuggestion: 'view_plans', estimatedTokens };
    }
    return { allowed: true, estimatedTokens };
  }

  return { allowed: true };
};
