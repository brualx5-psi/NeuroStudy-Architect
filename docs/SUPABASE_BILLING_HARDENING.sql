-- NeuroStudy billing hardening (Asaas)
-- Run this in Supabase SQL editor.

-- 1) Log table for webhook events (idempotency/audit)
create table if not exists asaas_webhook_events (
  id text primary key,
  event text not null,
  payment_id text,
  subscription_id text,
  payment_status text,
  external_reference text,
  user_id uuid,
  action text,
  reason text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- 2) Manual override (optional but recommended)
alter table users add column if not exists manual_plan_override text;
alter table users add column if not exists manual_override_expires_at timestamptz;
alter table users add column if not exists manual_override_reason text;
alter table users add column if not exists manual_override_by uuid;

-- Notes:
-- - The app will treat manual_plan_override as effective when expires_at is in the future.
-- - Webhook will ignore downgrade events (cancel/overdue/refund/etc) when subscription_id does not match the user's current asaas_subscription_id.
