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
select distinct on (c.id)
  c.id as company_id,
  c.domain,
  c.title,
  c.description,
  c.screenshot_url,
  c.logo_url,
  c.country_code,
  c.description_cn,
  c.description_usable,
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
  s.top_keywords,
  -- show in ranking if: is a brand, OR has no type entry at all (legacy company)
  (
    exists (select 1 from public.brands b where b.company_id = c.id)
    or (
      not exists (select 1 from public.brands b where b.company_id = c.id)
      and not exists (select 1 from public.service_providers sp where sp.company_id = c.id)
    )
  ) as show_in_ranking
from public.companies c
left join public.snapshots s on s.company_id = c.id
left join public.categories cat on cat.id = c.category_id
left join public.categories parent_cat on parent_cat.id = cat.parent_id
order by c.id, s.snapshot_date desc;

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
  is_partner boolean not null default false,
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
  id                    uuid primary key default gen_random_uuid(),
  submitted_by          uuid not null references auth.users(id),
  status                text not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected')),
  is_brand              boolean not null default false,
  is_service_provider   boolean not null default false,
  check (is_brand or is_service_provider),
  name                  text not null,
  domain                text not null,
  images                            jsonb not null default '[]',
  related_service_provider_names    text[] not null default '{}',
  related_brand_names               text[] not null default '{}',
  reviewer_notes        text,
  reviewed_at           timestamptz,
  apify_status          text not null default 'pending'
                          check (apify_status in ('pending', 'running', 'complete', 'failed')),
  apify_run_id          text,
  apify_logo_run_id     text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
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

-- 11. Staged companies (scraped data awaiting admin approval)
create table staged_companies (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references company_submissions(id) on delete cascade,
  domain         text not null,
  title          text,
  description    text,
  description_cn text,
  screenshot_url text,
  logo_url       text,
  country_code   text,
  category_id    uuid references categories(id) on delete set null,
  created_at     timestamptz default now()
);

create index idx_staged_companies_submission on staged_companies(submission_id);
create index idx_staged_companies_domain     on staged_companies(domain);

alter table staged_companies enable row level security;

create policy "Admins read staged_companies"
  on staged_companies for select to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

grant select on public.staged_companies to authenticated;
grant all on public.staged_companies to service_role;

-- 12. Staged snapshots (time-series data for staged companies)
create table staged_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  staged_company_id  uuid not null references staged_companies(id) on delete cascade,
  snapshot_date      date not null,
  global_rank        integer,
  country_code       text,
  country_rank       integer,
  category_rank      integer,
  visits             bigint,
  bounce_rate        numeric,
  pages_per_visit    numeric,
  time_on_site       numeric,
  monthly_visits     jsonb,
  top_country_shares jsonb,
  traffic_sources    jsonb,
  top_keywords       jsonb,
  created_at         timestamptz default now(),
  unique(staged_company_id, snapshot_date)
);

create index idx_staged_snapshots_company on staged_snapshots(staged_company_id);
create index idx_staged_snapshots_date    on staged_snapshots(snapshot_date desc);

alter table staged_snapshots enable row level security;

create policy "Admins read staged_snapshots"
  on staged_snapshots for select to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

grant select on public.staged_snapshots to authenticated;
grant all on public.staged_snapshots to service_role;

-- 13. approve_submission RPC
-- Admin-only. Promotes staged data into the live companies/snapshots tables,
-- then marks the submission as approved.
create or replace function approve_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staged      staged_companies%rowtype;
  v_submission  company_submissions%rowtype;
  v_company_id  uuid;
begin
  -- Caller must be an admin
  if not exists (
    select 1 from user_profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Forbidden: admin only';
  end if;

  -- Fetch the submission (for type flags and related names)
  select * into v_submission
  from company_submissions
  where id = p_submission_id;

  if v_submission.id is null then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  -- Fetch the staged company row for this submission
  select * into v_staged
  from staged_companies
  where submission_id = p_submission_id
  limit 1;

  if v_staged.id is null then
    raise exception 'No staged company found for submission %', p_submission_id;
  end if;

  -- Upsert into live companies table (keyed on domain)
  insert into companies (domain, title, description, description_cn, screenshot_url, logo_url, country_code, category_id)
  values (v_staged.domain, v_staged.title, v_staged.description, v_staged.description_cn,
          v_staged.screenshot_url, v_staged.logo_url, v_staged.country_code, v_staged.category_id)
  on conflict (domain) do update
    set title          = excluded.title,
        description    = excluded.description,
        description_cn = excluded.description_cn,
        screenshot_url = excluded.screenshot_url,
        logo_url       = excluded.logo_url,
        country_code   = excluded.country_code,
        category_id    = excluded.category_id,
        updated_at     = now()
  returning id into v_company_id;

  -- Copy staged snapshots into live snapshots, upsert on (company_id, snapshot_date)
  insert into snapshots (
    company_id, snapshot_date, global_rank, country_code, country_rank,
    category_rank, visits, bounce_rate, pages_per_visit, time_on_site,
    monthly_visits, top_country_shares, traffic_sources, top_keywords
  )
  select
    v_company_id, snapshot_date, global_rank, country_code, country_rank,
    category_rank, visits, bounce_rate, pages_per_visit, time_on_site,
    monthly_visits, top_country_shares, traffic_sources, top_keywords
  from staged_snapshots
  where staged_company_id = v_staged.id
  on conflict (company_id, snapshot_date) do update
    set global_rank        = excluded.global_rank,
        country_code       = excluded.country_code,
        country_rank       = excluded.country_rank,
        category_rank      = excluded.category_rank,
        visits             = excluded.visits,
        bounce_rate        = excluded.bounce_rate,
        pages_per_visit    = excluded.pages_per_visit,
        time_on_site       = excluded.time_on_site,
        monthly_visits     = excluded.monthly_visits,
        top_country_shares = excluded.top_country_shares,
        traffic_sources    = excluded.traffic_sources,
        top_keywords       = excluded.top_keywords;

  -- Populate type extension tables
  if v_submission.is_brand then
    insert into brands (company_id, domain, related_service_provider_names)
    values (v_company_id, v_staged.domain, v_submission.related_service_provider_names)
    on conflict (company_id) do update
      set domain                         = excluded.domain,
          related_service_provider_names = excluded.related_service_provider_names,
          updated_at                     = now();
  end if;

  if v_submission.is_service_provider then
    insert into service_providers (company_id, domain, related_brand_names)
    values (v_company_id, v_staged.domain, v_submission.related_brand_names)
    on conflict (company_id) do update
      set domain              = excluded.domain,
          related_brand_names = excluded.related_brand_names,
          updated_at          = now();
  end if;

  -- Mark submission approved
  update company_submissions
  set status      = 'approved',
      reviewed_at = now(),
      updated_at  = now()
  where id = p_submission_id;
end;
$$;

grant execute on function approve_submission(uuid) to authenticated;

-- 14. Brands and service providers extension tables
create table brands (
  company_id                     uuid primary key references companies(id) on delete cascade,
  domain                         text,
  related_service_provider_names text[] not null default '{}',
  created_at                     timestamptz default now(),
  updated_at                     timestamptz default now()
);

alter table brands enable row level security;
create policy "Public read brands" on brands for select using (true);
grant select on public.brands to authenticated;
grant all on public.brands to service_role;

create table service_providers (
  company_id          uuid primary key references companies(id) on delete cascade,
  domain              text,
  related_brand_names text[] not null default '{}',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table service_providers enable row level security;
create policy "Public read service_providers" on service_providers for select using (true);
grant select on public.service_providers to authenticated;
grant all on public.service_providers to service_role;

-- 15. Admin UPDATE policy for reject flow (plain UPDATE, no RPC needed)
create policy "Admins update submissions"
  on company_submissions for update
  to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

grant update on public.company_submissions to authenticated;

-- 16. Partner role management (admin-only RPCs)
create or replace function search_users_by_email(p_email text)
returns table(id uuid, email text, display_name text, is_partner boolean)
language plpgsql security definer as $$
begin
  return query
  select u.id, u.email::text, p.display_name, coalesce(p.is_partner, false)
  from auth.users u
  left join user_profiles p on p.id = u.id
  where u.email ilike '%' || p_email || '%'
  limit 10;
end;
$$;

create or replace function grant_partner_role(p_emails text[])
returns void language plpgsql security definer as $$
begin
  update user_profiles
  set is_partner = true
  where id in (
    select id from auth.users where email = any(p_emails)
  );
end;
$$;