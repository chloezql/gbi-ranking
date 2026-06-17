-- =============================================
-- GBI Ranking Database Schema
-- Run this in Supabase SQL Editor (one time)
-- =============================================

-- 1. Categories table (hierarchical)
create table categories (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null,
  parent_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_categories_parent on categories(parent_id);
create index idx_categories_slug on categories(slug);

-- 2. Companies table (core info, relatively stable)
create table companies (
  id uuid default gen_random_uuid() primary key,
  domain text unique not null,
  title text,
  description text,
  screenshot_url text,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_companies_domain on companies(domain);
create index idx_companies_category on companies(category_id);

-- 3. Snapshots table (time-series traffic data, one row per company per month)
create table snapshots (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references companies(id) on delete cascade,
  snapshot_date date not null,
  global_rank integer,
  country_code text,
  country_rank integer,
  category_rank integer,
  visits bigint,
  bounce_rate numeric,
  pages_per_visit numeric,
  time_on_site numeric,
  monthly_visits jsonb,
  top_country_shares jsonb,
  traffic_sources jsonb,
  top_keywords jsonb,
  created_at timestamptz default now(),
  unique(company_id, snapshot_date)
);

create index idx_snapshots_company on snapshots(company_id);
create index idx_snapshots_date on snapshots(snapshot_date desc);
create index idx_snapshots_visits on snapshots(visits desc);
create index idx_snapshots_company_date on snapshots(company_id, snapshot_date desc);

-- 4. Useful view: latest snapshot per company (always get the newest data)
create or replace view company_latest as
select distinct on (s.company_id)
  c.id as company_id,
  c.domain,
  c.title,
  c.description,
  c.screenshot_url,
  cat.slug as category_slug,
  cat.name as category_name,
  parent_cat.slug as parent_category_slug,
  parent_cat.name as parent_category_name,
  s.snapshot_date,
  s.global_rank,
  s.country_code,
  s.country_rank,
  s.category_rank,
  s.visits,
  s.bounce_rate,
  s.pages_per_visit,
  s.time_on_site,
  s.monthly_visits,
  s.top_country_shares,
  s.traffic_sources,
  s.top_keywords
from companies c
left join snapshots s on s.company_id = c.id
left join categories cat on cat.id = c.category_id
left join categories parent_cat on parent_cat.id = cat.parent_id
order by s.company_id, s.snapshot_date desc;

-- 5. Enable Row Level Security (public read-only)
alter table categories enable row level security;
alter table companies enable row level security;
alter table snapshots enable row level security;

create policy "Public read categories" on categories for select using (true);
create policy "Public read companies" on companies for select using (true);
create policy "Public read snapshots" on snapshots for select using (true);

-- 6. User profiles (extends auth.users)
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Required explicit grants for Data API access (enforced on new projects from May 30, 2026)
grant select, insert, update
  on public.user_profiles
  to authenticated;

grant select, insert, update, delete
  on public.user_profiles
  to service_role;

-- RLS (row-level security restricts authenticated users to their own row)
alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update to authenticated
  using (auth.uid() = id);

-- 7. Company submissions (pending review queue)
create table company_submissions (
  id                uuid primary key default gen_random_uuid(),
  submitted_by      uuid not null references auth.users(id),
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  company_type      text not null
                      check (company_type in ('brand', 'service_provider')),
  name              text not null,
  domain            text not null,
  images            jsonb not null default '[]',
  related_companies jsonb not null default '[]',
  reviewer_notes    text,
  reviewed_at       timestamptz,
  apify_status      text not null default 'pending'
                      check (apify_status in ('pending', 'running', 'complete', 'failed')),
  apify_run_id      text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index idx_submissions_user   on company_submissions(submitted_by);
create index idx_submissions_domain on company_submissions(domain);
create index idx_submissions_status on company_submissions(status);

alter table company_submissions enable row level security;

create policy "Users read own submissions"
  on company_submissions for select
  to authenticated
  using (auth.uid() = submitted_by);

create policy "Users insert own submissions"
  on company_submissions for insert
  to authenticated
  with check (auth.uid() = submitted_by);

grant select, insert on public.company_submissions to authenticated;
grant all on public.company_submissions to service_role;

-- 8. Storage bucket for profile avatars
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true);

create policy "Users manage own avatar"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- 9. Storage bucket for company images
insert into storage.buckets (id, name, public)
  values ('company-images', 'company-images', true);

create policy "Users upload company images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public read company images"
  on storage.objects for select
  using (bucket_id = 'company-images');

-- 10. Admin policies
create policy "Admins read all submissions"
  on company_submissions for select
  to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );
