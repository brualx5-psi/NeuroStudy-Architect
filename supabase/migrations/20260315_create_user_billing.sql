-- Create user_billing table to store billing identifiers (CPF/CNPJ)

create table if not exists public.user_billing (
  user_id uuid primary key references public.users(id) on delete cascade,
  cpf_cnpj text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_billing enable row level security;

drop policy if exists "user_billing_select_own" on public.user_billing;
create policy "user_billing_select_own"
on public.user_billing
for select
using (auth.uid() = user_id);

drop policy if exists "user_billing_insert_own" on public.user_billing;
create policy "user_billing_insert_own"
on public.user_billing
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_billing_update_own" on public.user_billing;
create policy "user_billing_update_own"
on public.user_billing
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
