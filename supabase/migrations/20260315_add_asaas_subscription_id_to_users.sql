-- Add Asaas subscription tracking to users

alter table public.users
  add column if not exists asaas_subscription_id text;

-- optional: keep which provider created the active subscription
alter table public.users
  add column if not exists billing_provider text;
