alter table public.users
add column if not exists is_admin boolean not null default false;
