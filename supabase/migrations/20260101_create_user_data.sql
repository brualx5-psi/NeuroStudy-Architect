-- Criar tabela user_data para armazenar estudos e pastas dos usuários
create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Constraint de unicidade no user_id (1 registro por usuário)
create unique index if not exists user_data_user_id_key on public.user_data (user_id);

-- Habilitar RLS
alter table public.user_data enable row level security;

-- Políticas RLS: usuário só pode ver/modificar seus próprios dados
create policy "Users can view own data" on public.user_data
  for select using (auth.uid() = user_id);

create policy "Users can insert own data" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "Users can update own data" on public.user_data
  for update using (auth.uid() = user_id);

create policy "Users can delete own data" on public.user_data
  for delete using (auth.uid() = user_id);
