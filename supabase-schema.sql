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

-- 8. Company claims (user ↔ company ownership)
create table company_claims (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  user_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'manual_review')),
  review_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, company_id)
);

create index idx_claims_user on company_claims(user_id);
create index idx_claims_company on company_claims(company_id);
create index idx_claims_status on company_claims(status);

alter table company_claims enable row level security;

create policy "Users can read own claims"
  on company_claims for select to authenticated
  using (auth.uid() = user_id);

-- Clients can only read their own claims; all inserts go through the RPC below
grant select on public.company_claims to authenticated;
grant select, insert, update, delete on public.company_claims to service_role;

-- 9. claim_company RPC
-- SECURITY DEFINER so it runs as the function owner and bypasses RLS for inserts.
-- Inserts a pending row, then resolves to 'approved' (domain match) or 'rejected'.
-- user_email and status are never trusted from the client.
create or replace function claim_company(p_domain text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id      uuid;
  v_company_domain  text;
  v_user_id         uuid;
  v_user_email      text;
  v_email_domain    text;
  v_domain_clean    text;
  v_status          text;
begin
  v_user_id    := auth.uid();
  v_user_email := auth.jwt() ->> 'email';

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id, domain into v_company_id, v_company_domain
  from companies where domain = p_domain;

  if v_company_id is null then
    raise exception 'Company not found';
  end if;

  v_email_domain := lower(split_part(v_user_email, '@', 2));
  v_domain_clean := lower(regexp_replace(v_company_domain, '^www\.', ''));

  if v_email_domain = v_domain_clean
     or v_email_domain like ('%.' || v_domain_clean) then
    v_status := 'approved';
  else
    v_status := 'rejected';
  end if;

  -- Insert as pending first (audit trail), then update to final status
  insert into company_claims (user_id, company_id, user_email, status)
  values (v_user_id, v_company_id, v_user_email, 'pending')
  on conflict (user_id, company_id)
  do update set status = 'pending', updated_at = now();

  update company_claims
  set status = v_status, updated_at = now()
  where user_id = v_user_id and company_id = v_company_id;

  return v_status;
end;
$$;

grant execute on function claim_company(text) to authenticated;

-- 10. Storage bucket for profile avatars
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true);

create policy "Users manage own avatar"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
