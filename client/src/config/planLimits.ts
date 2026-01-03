export type PlanName = 'free' | 'starter' | 'pro';

export type TokenTaskType = 'roadmap' | 'quiz' | 'flashcards' | 'chat';

export type PlanLimits = {
  roadmaps: number;
  sources_per_study: number;
  pages_per_source: number;
  youtube_minutes: number;
  youtube_minutes_per_video: number;
  web_research: number;
  chat_messages: number;
  monthly_tokens: number;
  max_tokens_per_roadmap: number;
  max_tokens_per_chat_message: number;
  max_output_tokens: Record<TokenTaskType, number>;
};

export const PLAN_LABELS: Record<PlanName, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro'
};

export const PLAN_PRICES: Record<PlanName, string> = {
  free: 'R$ 0',
  starter: 'R$ 29,90',
  pro: 'R$ 59,90'
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    roadmaps: 3,
    sources_per_study: 2,
    pages_per_source: 30,
    youtube_minutes: 30,
    youtube_minutes_per_video: 30,
    web_research: 10,
    chat_messages: 50,
    monthly_tokens: 500_000,
    max_tokens_per_roadmap: 100_000,
    max_tokens_per_chat_message: 5_000,
    max_output_tokens: {
      roadmap: 30_000,
      quiz: 3_000,
      flashcards: 5_000,
      chat: 1_000
    }
  },
  starter: {
    roadmaps: 25,
    sources_per_study: 10,
    pages_per_source: 200,
    youtube_minutes: 200,
    youtube_minutes_per_video: 60,
    web_research: 50,
    chat_messages: 500,
    monthly_tokens: 5_000_000,
    max_tokens_per_roadmap: 300_000,
    max_tokens_per_chat_message: 10_000,
    max_output_tokens: {
      roadmap: 50_000,
      quiz: 5_000,
      flashcards: 10_000,
      chat: 2_000
    }
  },
  pro: {
    roadmaps: 100,
    sources_per_study: 20,
    pages_per_source: 500,
    youtube_minutes: 1_000,
    youtube_minutes_per_video: 120,
    web_research: 200,
    chat_messages: 2_000,
    monthly_tokens: 20_000_000,
    max_tokens_per_roadmap: 500_000,
    max_tokens_per_chat_message: 20_000,
    max_output_tokens: {
      roadmap: 80_000,
      quiz: 10_000,
      flashcards: 20_000,
      chat: 4_000
    }
  }
};
