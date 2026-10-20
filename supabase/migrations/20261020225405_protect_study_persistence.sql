-- Preserve existing content. Version changes and history are committed atomically.
alter table public.user_data add column if not exists study_revision integer not null default 0;
alter table public.user_data enable row level security;
-- Restrictive policies also constrain pre-existing broad permissive policies.
create policy user_data_owner_boundary on public.user_data as restrictive for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_data_no_client_delete on public.user_data as restrictive for delete to authenticated using (false);

create table public.study_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null,
  content jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, revision)
);
alter table public.study_history enable row level security;
revoke all on public.study_history from anon, authenticated;
grant select on public.study_history to authenticated;
create policy study_history_owner_read on public.study_history for select to authenticated using ((select auth.uid()) = user_id);

insert into public.study_history(user_id, revision, content, saved_at)
  select user_id, study_revision, coalesce(content, '{}'), coalesce(updated_at, now()) from public.user_data;

create schema if not exists private;
revoke all on schema private from public;

-- Only the trigger can write history; clients cannot edit or delete old copies.
create function private.guard_study_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.study_revision <> 0 or coalesce(new.content->'studies', '[]'::jsonb) <> '[]'::jsonb
      or coalesce(new.content->'folders', '[]'::jsonb) <> '[]'::jsonb then
      raise exception 'Use save_study_snapshot to create studies' using errcode = '40001';
    end if;
    return new;
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'Study ownership cannot be changed' using errcode = '42501';
  end if;
  if (coalesce(new.content->'studies', '[]'::jsonb), coalesce(new.content->'folders', '[]'::jsonb))
     is distinct from (coalesce(old.content->'studies', '[]'::jsonb), coalesce(old.content->'folders', '[]'::jsonb)) then
    if new.study_revision <> old.study_revision + 1 then
      raise exception 'Study version conflict; refresh the application' using errcode = '40001';
    end if;
    insert into public.study_history(user_id, revision, content, saved_at)
      values (old.user_id, old.study_revision, coalesce(old.content, '{}'), coalesce(old.updated_at, now()))
      on conflict (user_id, revision) do nothing;
    delete from public.study_history h where h.user_id = old.user_id and h.revision not in
      (select revision from public.study_history where user_id = old.user_id order by revision desc limit 50);
  elsif new.study_revision <> old.study_revision then
    raise exception 'Revision cannot change without study changes' using errcode = '40001';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_study_snapshot() from public, anon, authenticated;
create trigger guard_study_snapshot before insert or update on public.user_data
  for each row execute function private.guard_study_snapshot();

create function public.save_study_snapshot(p_user_id uuid, p_expected_revision integer, p_studies jsonb, p_folders jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare current_row public.user_data%rowtype;
begin
  if p_user_id is null or (coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_user_id) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_studies) is distinct from 'array' or jsonb_typeof(p_folders) is distinct from 'array' then
    raise exception 'Studies and folders must be arrays' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_studies || p_folders) item
      where jsonb_typeof(item) <> 'object' or coalesce(item->>'id', '') = '')
    or (select count(*) <> count(distinct item->>'id') from jsonb_array_elements(p_studies) item)
    or (select count(*) <> count(distinct item->>'id') from jsonb_array_elements(p_folders) item) then
    raise exception 'Invalid or duplicate study/folder IDs' using errcode = '22023';
  end if;
  insert into public.user_data(user_id, content) values (p_user_id, '{"studies":[],"folders":[]}') on conflict (user_id) do nothing;
  select * into strict current_row from public.user_data where user_id = p_user_id for update;
  if p_expected_revision is distinct from current_row.study_revision then
    raise exception 'Study version conflict' using errcode = '40001';
  end if;
  if (coalesce(current_row.content->'studies', '[]'::jsonb), coalesce(current_row.content->'folders', '[]'::jsonb))
     is not distinct from (p_studies, p_folders) then return current_row.study_revision; end if;
  update public.user_data set content = coalesce(content, '{}') || jsonb_build_object('studies', p_studies, 'folders', p_folders),
    study_revision = current_row.study_revision + 1, updated_at = clock_timestamp() where user_id = p_user_id;
  return current_row.study_revision + 1;
end;
$$;
revoke all on function public.save_study_snapshot(uuid, integer, jsonb, jsonb) from public, anon;
grant execute on function public.save_study_snapshot(uuid, integer, jsonb, jsonb) to authenticated, service_role;

-- Patch only the profile under the row lock, never a previously read collection.
create function public.save_user_profile(p_user_id uuid, p_profile jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_user_id is null or auth.uid() is distinct from p_user_id then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_profile) is distinct from 'object' then raise exception 'Invalid profile'; end if;
  insert into public.user_data(user_id, content) values (p_user_id, jsonb_build_object('profile', p_profile))
    on conflict (user_id) do update set content = coalesce(public.user_data.content, '{}') || jsonb_build_object('profile', p_profile), updated_at = clock_timestamp();
end;
$$;
revoke all on function public.save_user_profile(uuid, jsonb) from public, anon;
grant execute on function public.save_user_profile(uuid, jsonb) to authenticated;
