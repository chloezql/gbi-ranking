-- Run this in Supabase SQL Editor to add logo_url column
alter table companies add column if not exists logo_url text;

-- Recreate the view to include logo_url
create or replace view company_latest as
select distinct on (s.company_id)
  c.id as company_id,
  c.domain,
  c.title,
  c.description,
  c.screenshot_url,
  c.logo_url,
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
