do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_data'
  ) then
    delete from public.user_data a
    using public.user_data b
    where a.user_id = b.user_id
      and (
        coalesce(a.updated_at, '1970-01-01'::timestamptz) < coalesce(b.updated_at, '1970-01-01'::timestamptz)
        or (
          coalesce(a.updated_at, '1970-01-01'::timestamptz) = coalesce(b.updated_at, '1970-01-01'::timestamptz)
          and a.ctid < b.ctid
        )
      );

    if not exists (
      select 1
      from pg_constraint
      where conname = 'user_data_user_id_key'
    ) then
      alter table public.user_data
        add constraint user_data_user_id_key unique (user_id);
    end if;
  end if;
end $$;
