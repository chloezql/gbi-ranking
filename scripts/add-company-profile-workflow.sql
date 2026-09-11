-- Type/category taxonomy and claimed-company profile edit workflow.
-- Run this once in the production Supabase SQL Editor before deploying the UI.

begin;

alter table public.companies
  add column if not exists company_type text not null default 'brand'
    check (company_type in ('brand', 'service_provider')),
  add column if not exists category_slugs text[] not null default '{}';

alter table public.company_submissions
  add column if not exists company_type text,
  add column if not exists primary_category_slug text,
  add column if not exists category_slugs text[] not null default '{}';

update public.companies c
set company_type = 'service_provider'
where exists (select 1 from public.service_providers sp where sp.company_id = c.id)
  and not exists (select 1 from public.brands b where b.company_id = c.id);

update public.company_submissions
set company_type = case when is_service_provider then 'service_provider' else 'brand' end
where company_type is null;

update public.company_submissions
set category_slugs = array_remove(array[primary_category_slug], null)
where cardinality(category_slugs) = 0 and primary_category_slug is not null;

insert into public.categories (slug, name)
values
  ('retail_ecommerce', 'Retail & E-commerce'),
  ('consumer_electronics', 'Consumer Electronics'),
  ('beauty_personal_care', 'Beauty & Personal Care'),
  ('fashion_apparel', 'Fashion & Apparel'),
  ('automotive', 'Automotive'),
  ('home_living', 'Home & Living'),
  ('health_wellness', 'Health & Wellness'),
  ('food_beverage', 'Food & Beverage'),
  ('sports_outdoors', 'Sports & Outdoors'),
  ('travel_hospitality', 'Travel & Hospitality'),
  ('entertainment_media', 'Entertainment & Media'),
  ('software_business_services', 'Software & Business Services'),
  ('marketing_creative_services', 'Marketing & Creative Services'),
  ('logistics_supply_chain', 'Logistics & Supply Chain'),
  ('payments_fintech', 'Payments & Fintech'),
  ('other', 'Other')
on conflict (slug) do update set name = excluded.name;

create or replace function public.apply_submission_taxonomy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_id uuid;
begin
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  select id into v_category_id
  from categories
  where slug = coalesce(new.primary_category_slug, new.category_slugs[1]);

  update companies
  set company_type = coalesce(new.company_type, case when new.is_service_provider then 'service_provider' else 'brand' end),
      category_slugs = case
        when cardinality(new.category_slugs) > 0 then new.category_slugs
        when new.primary_category_slug is not null then array[new.primary_category_slug]
        else category_slugs
      end,
      category_id = coalesce(v_category_id, category_id),
      updated_at = now()
  where domain = new.domain;

  return new;
end;
$$;

drop trigger if exists sync_submission_taxonomy on public.company_submissions;
create trigger sync_submission_taxonomy
after update of status on public.company_submissions
for each row execute function public.apply_submission_taxonomy();

create table if not exists public.company_profile_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  claim_id uuid not null references public.company_claims(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  changes jsonb not null,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_updates_status on public.company_profile_updates(status, created_at desc);
create index if not exists idx_profile_updates_submitter on public.company_profile_updates(submitted_by, created_at desc);
create unique index if not exists idx_profile_updates_one_pending
  on public.company_profile_updates(company_id, submitted_by)
  where status = 'pending';

alter table public.company_profile_updates enable row level security;

drop policy if exists "Users read own company profile updates" on public.company_profile_updates;
create policy "Users read own company profile updates"
  on public.company_profile_updates for select to authenticated
  using (submitted_by = auth.uid());

drop policy if exists "Admins read company profile updates" on public.company_profile_updates;
create policy "Admins read company profile updates"
  on public.company_profile_updates for select to authenticated
  using (exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin'));

grant select on public.company_profile_updates to authenticated;
grant all on public.company_profile_updates to service_role;

create or replace function public.submit_company_profile_update(p_domain text, p_changes jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_claim_id uuid;
  v_user_id uuid := auth.uid();
  v_key text;
  v_update_id uuid;
  v_primary_category text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'At least one profile change is required';
  end if;

  for v_key in select jsonb_object_keys(p_changes) loop
    if v_key not in ('title', 'description', 'logo_url', 'country_code', 'company_type', 'primary_category_slug', 'category_slugs') then
      raise exception 'Unsupported profile field: %', v_key;
    end if;
  end loop;

  select id into v_company_id from companies where domain = lower(regexp_replace(p_domain, '^[Ww][Ww][Ww][.]', ''));
  if v_company_id is null then raise exception 'Company not found'; end if;

  select id into v_claim_id from company_claims
  where company_id = v_company_id and user_id = v_user_id and status = 'approved';
  if v_claim_id is null then raise exception 'An approved claim is required to edit this profile'; end if;

  if p_changes ? 'company_type' and p_changes ->> 'company_type' not in ('brand', 'service_provider') then
    raise exception 'Invalid company type';
  end if;

  v_primary_category := coalesce(p_changes ->> 'primary_category_slug', (p_changes -> 'category_slugs') ->> 0);
  if v_primary_category is not null and not exists (select 1 from categories where slug = v_primary_category) then
    raise exception 'Invalid primary category';
  end if;

  insert into company_profile_updates (company_id, claim_id, submitted_by, changes)
  values (v_company_id, v_claim_id, v_user_id, p_changes)
  returning id into v_update_id;

  return v_update_id;
end;
$$;

grant execute on function public.submit_company_profile_update(text, jsonb) to authenticated;

create or replace function public.review_company_profile_update(
  p_update_id uuid,
  p_status text,
  p_reviewer_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_update company_profile_updates%rowtype;
  v_category_slugs text[];
  v_primary_slug text;
  v_category_id uuid;
  v_company_type text;
begin
  if p_status not in ('approved', 'rejected') then raise exception 'Invalid review status'; end if;
  if not exists (select 1 from user_profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Forbidden: admin only';
  end if;

  select * into v_update from company_profile_updates where id = p_update_id for update;
  if v_update.id is null then raise exception 'Profile update not found'; end if;
  if v_update.status <> 'pending' then raise exception 'Profile update has already been reviewed'; end if;

  if p_status = 'approved' then
    select category_slugs, company_type into v_category_slugs, v_company_type from companies where id = v_update.company_id;
    if v_update.changes ? 'category_slugs' then
      select array_agg(value) into v_category_slugs from jsonb_array_elements_text(v_update.changes -> 'category_slugs') as value;
    end if;
    v_primary_slug := coalesce(v_update.changes ->> 'primary_category_slug', v_category_slugs[1]);
    select id into v_category_id from categories where slug = v_primary_slug;
    if v_primary_slug is not null and v_category_id is null then raise exception 'Invalid primary category'; end if;
    v_company_type := coalesce(v_update.changes ->> 'company_type', v_company_type);

    update companies
    set title = case when v_update.changes ? 'title' then v_update.changes ->> 'title' else title end,
        description = case when v_update.changes ? 'description' then v_update.changes ->> 'description' else description end,
        logo_url = case when v_update.changes ? 'logo_url' then nullif(v_update.changes ->> 'logo_url', '') else logo_url end,
        country_code = case when v_update.changes ? 'country_code' then upper(v_update.changes ->> 'country_code') else country_code end,
        company_type = v_company_type,
        category_slugs = coalesce(v_category_slugs, category_slugs),
        category_id = coalesce(v_category_id, category_id),
        updated_at = now()
    where id = v_update.company_id;

    if v_company_type = 'brand' then
      insert into brands (company_id, domain)
      select id, domain from companies where id = v_update.company_id
      on conflict (company_id) do update set domain = excluded.domain, updated_at = now();
      delete from service_providers where company_id = v_update.company_id;
    else
      insert into service_providers (company_id, domain)
      select id, domain from companies where id = v_update.company_id
      on conflict (company_id) do update set domain = excluded.domain, updated_at = now();
      delete from brands where company_id = v_update.company_id;
    end if;
  end if;

  update company_profile_updates
  set status = p_status, reviewer_notes = p_reviewer_note, reviewed_at = now(), updated_at = now()
  where id = p_update_id;
end;
$$;

grant execute on function public.review_company_profile_update(uuid, text, text) to authenticated;

drop view if exists public.company_latest;
create view public.company_latest as
select distinct on (c.id)
  c.id as company_id,
  c.domain,
  c.title,
  c.description,
  c.description_cn,
  c.description_usable,
  c.screenshot_url,
  c.logo_url,
  c.country_code,
  c.company_type,
  c.category_slugs,
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
  (exists (select 1 from public.brands b where b.company_id = c.id)
    or (not exists (select 1 from public.brands b where b.company_id = c.id)
      and not exists (select 1 from public.service_providers sp where sp.company_id = c.id))) as show_in_ranking
from public.companies c
left join public.snapshots s on s.company_id = c.id
left join public.categories cat on cat.id = c.category_id
left join public.categories parent_cat on parent_cat.id = cat.parent_id
order by c.id, s.snapshot_date desc;

notify pgrst, 'reload schema';

commit;
