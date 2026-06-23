-- Keep unusable descriptions for review while excluding them from the frontend.
-- Existing companies are treated as usable until they are re-imported or audited.

alter table public.companies
  add column if not exists description_usable boolean not null default true;

create index if not exists idx_companies_description_usable
  on public.companies(description_usable);

create or replace view public.company_latest as
select distinct on (c.id)
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
  s.top_keywords,
  c.description_usable
from public.companies c
left join public.snapshots s on s.company_id = c.id
left join public.categories cat on cat.id = c.category_id
left join public.categories parent_cat on parent_cat.id = cat.parent_id
order by c.id, s.snapshot_date desc;
