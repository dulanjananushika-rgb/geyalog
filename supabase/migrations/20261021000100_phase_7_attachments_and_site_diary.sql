-- Phase 7: Attachments, Photos & Daily Site Diary

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'site_diary', 'receipt', 'goods_receipt', 'worker', 'material', 'general')),
  entity_id uuid,
  file_url text not null,
  file_name text,
  caption text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists attachments_entity_idx on public.attachments (organization_id, entity_type, entity_id);
create index if not exists attachments_project_idx on public.attachments (organization_id, project_id);

alter table public.attachments enable row level security;

create policy "Organization members can view attachments"
  on public.attachments for select to authenticated
  using (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = attachments.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  );

create policy "Organization members can upload attachments"
  on public.attachments for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = attachments.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  );

create policy "Users can delete their own attachments"
  on public.attachments for delete to authenticated
  using (created_by = (select auth.uid()));

-- Daily Site Diary
create table if not exists public.site_diaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  diary_date date not null default current_date,
  weather text check (weather in ('sunny', 'cloudy', 'rainy', 'heavy_rain', 'windy')),
  work_completed text not null,
  issues_or_delays text,
  workers_count integer default 0 check (workers_count >= 0),
  visitors text,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, project_id, diary_date)
);

create index if not exists site_diaries_project_date_idx on public.site_diaries (organization_id, project_id, diary_date desc);

alter table public.site_diaries enable row level security;

create policy "Organization members can view site diaries"
  on public.site_diaries for select to authenticated
  using (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = site_diaries.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  );

create policy "Active members can record site diary"
  on public.site_diaries for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = site_diaries.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('owner', 'admin', 'site_supervisor')
    )
  );

create policy "Site supervisors and managers can update diary"
  on public.site_diaries for update to authenticated
  using (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = site_diaries.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('owner', 'admin', 'site_supervisor')
    )
  );

grant select, insert, update, delete on public.attachments to authenticated;
grant select, insert, update on public.site_diaries to authenticated;
