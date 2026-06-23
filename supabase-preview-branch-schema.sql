-- =============================================
-- GBI Ranking Preview Branch Schema
-- Use this on an empty Supabase preview branch for safe import testing.
-- It matches the frontend fields expected by src/lib/data.ts.
-- =============================================

create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null,
  parent_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_categories_parent on categories(parent_id);
create index if not exists idx_categories_slug on categories(slug);

create table if not exists companies (
  id uuid default gen_random_uuid() primary key,
  domain text unique not null,
  title text,
  description text,
  screenshot_url text,
  logo_url text,
  country_code text,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_companies_domain on companies(domain);
create index if not exists idx_companies_category on companies(category_id);
create index if not exists idx_companies_country on companies(country_code);

create table if not exists snapshots (
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

create index if not exists idx_snapshots_company on snapshots(company_id);
create index if not exists idx_snapshots_date on snapshots(snapshot_date desc);
create index if not exists idx_snapshots_visits on snapshots(visits desc);
create index if not exists idx_snapshots_company_date on snapshots(company_id, snapshot_date desc);

create or replace view company_latest as
select distinct on (s.company_id)
  c.id as company_id,
  c.domain,
  c.title,
  c.description,
  c.screenshot_url,
  c.logo_url,
  c.country_code,
  cat.slug as category_slug,
  cat.name as category_name,
  parent_cat.slug as parent_category_slug,
  parent_cat.name as parent_category_name,
  s.snapshot_date,
  s.global_rank,
  s.country_code as traffic_country_code,
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

alter table categories enable row level security;
alter table companies enable row level security;
alter table snapshots enable row level security;

drop policy if exists "Public read categories" on categories;
drop policy if exists "Public read companies" on companies;
drop policy if exists "Public read snapshots" on snapshots;

create policy "Public read categories" on categories for select using (true);
create policy "Public read companies" on companies for select using (true);
create policy "Public read snapshots" on snapshots for select using (true);
