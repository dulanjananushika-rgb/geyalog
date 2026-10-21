-- Phase 1: user-owned profiles, provisioned atomically with Auth user creation.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'si', 'ta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "Users can update permitted fields on their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No client insert/delete, and no client access to id or timestamps.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, preferred_language) on public.profiles to authenticated;

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  submitted_name text;
begin
  submitted_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  if submitted_name is null or char_length(submitted_name) > 120 then
    submitted_name := '';
  end if;

  insert into public.profiles (id, full_name, created_at)
  values (new.id, submitted_name, new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

-- Backfill accounts that existed before this migration without fabricating a name.
insert into public.profiles (id, full_name, created_at)
select id,
  case
    when char_length(btrim(coalesce(raw_user_meta_data ->> 'full_name', ''))) <= 120
      then btrim(coalesce(raw_user_meta_data ->> 'full_name', ''))
    else ''
  end,
  created_at
from auth.users
on conflict (id) do nothing;
