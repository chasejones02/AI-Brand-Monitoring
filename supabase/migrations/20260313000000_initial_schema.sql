-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  stripe_customer_id text,
  subscription_status text default 'free' check (subscription_status in ('free', 'active', 'canceled', 'past_due')),
  subscription_tier text default 'starter' check (subscription_tier in ('starter', 'growth', 'agency')),
  created_at timestamptz default now()
);

-- Businesses table
create table if not exists public.businesses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  website text,
  industry text,
  created_at timestamptz default now()
);

-- Queries table (the 5 target queries per business)
create table if not exists public.queries (
  id uuid default uuid_generate_v4() primary key,
  business_id uuid references public.businesses(id) on delete cascade not null,
  query_text text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Scans table (one scan = one full run across all platforms for all queries)
create table if not exists public.scans (
  id uuid default uuid_generate_v4() primary key,
  business_id uuid references public.businesses(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  visibility_score numeric(5,2),
  triggered_by text default 'manual' check (triggered_by in ('manual', 'scheduled')),
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- Scan results table (one row per query + platform combination)
create table if not exists public.scan_results (
  id uuid default uuid_generate_v4() primary key,
  scan_id uuid references public.scans(id) on delete cascade not null,
  query_id uuid references public.queries(id) on delete cascade not null,
  platform text not null check (platform in ('openai', 'anthropic', 'perplexity', 'gemini')),
  raw_response text,
  mentioned boolean default false,
  mention_position integer,  -- 1 = first, 2 = second, etc. null = not mentioned
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  competitors_mentioned text[],  -- array of competitor names found in response
  mention_score integer default 0,
  position_score integer default 0,
  sentiment_score integer default 0,
  created_at timestamptz default now()
);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.queries enable row level security;
alter table public.scans enable row level security;
alter table public.scan_results enable row level security;

-- RLS Policies (safe to re-run)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can view own profile') then
    create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can update own profile') then
    create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'businesses' and policyname = 'Users can manage own businesses') then
    create policy "Users can manage own businesses" on public.businesses for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'queries' and policyname = 'Users can manage own queries') then
    create policy "Users can manage own queries" on public.queries for all using (
      auth.uid() = (select user_id from public.businesses where id = business_id)
    );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'scans' and policyname = 'Users can view own scans') then
    create policy "Users can view own scans" on public.scans for all using (
      auth.uid() = (select user_id from public.businesses where id = business_id)
    );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'scan_results' and policyname = 'Users can view own scan results') then
    create policy "Users can view own scan results" on public.scan_results for all using (
      auth.uid() = (select b.user_id from public.scans s join public.businesses b on s.business_id = b.id where s.id = scan_id)
    );
  end if;
end $$;
