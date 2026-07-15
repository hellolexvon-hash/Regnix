-- ─────────────────────────────────────────────────────────────────────────────
-- REGNIX — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. USER PROFILES (extends Supabase auth.users)
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  account_type    text not null check (account_type in ('company', 'client')),
  full_name       text not null,
  email           text not null,

  -- Company fields
  company_name    text,
  industry        text,
  gstin           text,

  -- Client/Consultant fields
  firm_name       text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 2. DOCUMENT GENERATOR SUBMISSIONS
create table if not exists public.document_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,

  -- Auto-populated from profile
  company_name    text not null,
  contact_email   text not null,

  -- Form fields
  act_type        text not null,          -- e.g. 'code_on_wages', 'clra', 'factories'
  state           text,                   -- for S&E Act
  head_count      integer not null check (head_count > 0),
  establishment_name text,
  address         text,

  status          text default 'pending' check (status in ('pending','processing','completed','failed')),
  created_at      timestamptz default now()
);

-- 3. ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.document_requests enable row level security;

-- Profiles: users can only read/write their own row
create policy "profiles: own row only"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Document requests: users see only their own
create policy "doc_requests: own rows"
  on public.document_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. AUTO-UPDATE updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 5. AUTO-CREATE profile on signup (trigger on auth.users)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, account_type, full_name, email, company_name, industry, gstin, firm_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'account_type', 'company'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'industry',
    new.raw_user_meta_data->>'gstin',
    new.raw_user_meta_data->>'firm_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
