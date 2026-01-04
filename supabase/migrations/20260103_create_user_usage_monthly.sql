create table if not exists public.user_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  month text not null,
  plan text not null,
  roadmaps_created integer not null default 0,
  web_searches_used integer not null default 0,
  youtube_minutes_used integer not null default 0,
  chat_messages integer not null default 0,
  tokens_estimated bigint not null default 0,
  tokens_used bigint not null default 0,
  chat_tokens_estimated bigint not null default 0,
  chat_tokens_used bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_usage_monthly_user_month_idx
  on public.user_usage_monthly (user_id, month);
