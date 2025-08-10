-- =====================================================
-- Migration: Create 10x Cards Schema (aligned to ai/db-plan.md)
-- =====================================================
-- Purpose: Initialize database schema per db-plan with RLS owner-only policies
-- Tables: profiles, decks, cards, reviews, ai_generations, ai_suggestions, (optional) study_sessions
-- Notes:
--  - Uses uuid PKs (gen_random_uuid), timestamptz in UTC
--  - Enables RLS and owner-only policies on all user tables
--  - Adds indexes and triggers to maintain updated_at
-- =====================================================

-- Required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- =====================================================
-- Utility: updated_at trigger
-- =====================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================
-- Table: profiles (1:1 with auth.users)
-- =====================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_owner_select" on profiles for select to authenticated using (id = auth.uid());
create policy "profiles_owner_insert" on profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_owner_update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_owner_delete" on profiles for delete to authenticated using (id = auth.uid());

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

-- =====================================================
-- Table: decks
-- =====================================================
create table decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  language_code text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

alter table decks enable row level security;

create index idx_decks_user_id on decks(user_id);

create policy "decks_owner_select" on decks for select to authenticated using (user_id = auth.uid());
create policy "decks_owner_insert" on decks for insert to authenticated with check (user_id = auth.uid());
create policy "decks_owner_update" on decks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "decks_owner_delete" on decks for delete to authenticated using (user_id = auth.uid());

create trigger trg_decks_updated_at
  before update on decks
  for each row execute function update_updated_at_column();

-- =====================================================
-- Table: cards
-- =====================================================
create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 2000),
  source text not null default 'manual' check (source in ('manual','ai')),
  is_archived boolean not null default false,
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz,
  last_reviewed_at timestamptz,
  repetitions_count integer not null default 0 check (repetitions_count >= 0),
  lapses_count integer not null default 0 check (lapses_count >= 0),
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor > 0),
  interval_days integer not null default 0 check (interval_days >= 0)
  -- Optional unique constraint to reduce duplicates:
  -- , unique(user_id, deck_id, lower(front), lower(back))
);

alter table cards enable row level security;

create index idx_cards_user_id on cards(user_id);
create index idx_cards_deck_id on cards(deck_id);
create index idx_cards_user_active_due on cards(user_id, is_archived, due_at);

create policy "cards_owner_select" on cards for select to authenticated using (user_id = auth.uid());
create policy "cards_owner_insert" on cards for insert to authenticated with check (user_id = auth.uid());
create policy "cards_owner_update" on cards for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cards_owner_delete" on cards for delete to authenticated using (user_id = auth.uid());

create trigger trg_cards_updated_at
  before update on cards
  for each row execute function update_updated_at_column();

-- =====================================================
-- Table: reviews
-- =====================================================
create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  rating smallint not null check (rating between 0 and 3),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  pre_ease_factor numeric(4,2),
  post_ease_factor numeric(4,2),
  pre_interval_days integer,
  post_interval_days integer,
  pre_repetitions_count integer,
  post_repetitions_count integer,
  pre_lapses_count integer,
  post_lapses_count integer,
  -- Optional FSRS fields
  pre_stability numeric,
  post_stability numeric,
  pre_difficulty numeric,
  post_difficulty numeric,
  pre_elapsed_days integer,
  post_elapsed_days integer,
  pre_scheduled_days integer,
  post_scheduled_days integer
);

alter table reviews enable row level security;

create index idx_reviews_card_id_reviewed_at on reviews(card_id, reviewed_at);
create index idx_reviews_user_id_reviewed_at on reviews(user_id, reviewed_at);

create policy "reviews_owner_select" on reviews for select to authenticated using (user_id = auth.uid());
create policy "reviews_owner_insert" on reviews for insert to authenticated with check (user_id = auth.uid());
create policy "reviews_owner_update" on reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews_owner_delete" on reviews for delete to authenticated using (user_id = auth.uid());

-- =====================================================
-- Table: ai_generations
-- =====================================================
create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1000 and 10000),
  model text,
  prompt_version text,
  tokens_input integer check (tokens_input is null or tokens_input >= 0),
  tokens_output integer check (tokens_output is null or tokens_output >= 0),
  cost_usd numeric(10,4) check (cost_usd is null or cost_usd >= 0),
  status text,
  error jsonb,
  ai_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_generations enable row level security;

create index idx_ai_generations_user_created on ai_generations(user_id, created_at);

create policy "ai_generations_owner_select" on ai_generations for select to authenticated using (user_id = auth.uid());
create policy "ai_generations_owner_insert" on ai_generations for insert to authenticated with check (user_id = auth.uid());
create policy "ai_generations_owner_update" on ai_generations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_generations_owner_delete" on ai_generations for delete to authenticated using (user_id = auth.uid());

create trigger trg_ai_generations_updated_at
  before update on ai_generations
  for each row execute function update_updated_at_column();

-- =====================================================
-- Table: ai_suggestions
-- =====================================================
create table ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid not null references ai_generations(id) on delete cascade,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 2000),
  status text not null default 'proposed' check (status in ('proposed','edited','accepted','rejected')),
  accepted_at timestamptz,
  card_id uuid references cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_suggestions enable row level security;

create index idx_ai_suggestions_user_status on ai_suggestions(user_id, status);
create index idx_ai_suggestions_generation_id on ai_suggestions(generation_id);
create index idx_ai_suggestions_card_id on ai_suggestions(card_id);

create policy "ai_suggestions_owner_select" on ai_suggestions for select to authenticated using (user_id = auth.uid());
create policy "ai_suggestions_owner_insert" on ai_suggestions for insert to authenticated with check (user_id = auth.uid());
create policy "ai_suggestions_owner_update" on ai_suggestions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_suggestions_owner_delete" on ai_suggestions for delete to authenticated using (user_id = auth.uid());

create trigger trg_ai_suggestions_updated_at
  before update on ai_suggestions
  for each row execute function update_updated_at_column();

-- =====================================================
-- Optional: study_sessions
-- =====================================================
create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table study_sessions enable row level security;

create index if not exists idx_study_sessions_user_started on study_sessions(user_id, started_at);

create policy "study_sessions_owner_select" on study_sessions for select to authenticated using (user_id = auth.uid());
create policy "study_sessions_owner_insert" on study_sessions for insert to authenticated with check (user_id = auth.uid());
create policy "study_sessions_owner_update" on study_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "study_sessions_owner_delete" on study_sessions for delete to authenticated using (user_id = auth.uid());

create trigger trg_study_sessions_updated_at
  before update on study_sessions
  for each row execute function update_updated_at_column();

-- =====================================================
-- End of migration
-- =====================================================