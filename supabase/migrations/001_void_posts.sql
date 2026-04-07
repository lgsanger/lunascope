-- Reflection Void — shared posts (Supabase REST from the static app)
-- Run in Supabase SQL editor or via CLI, then enable RLS policies below.

create table if not exists public.void_posts (
  id uuid primary key default gen_random_uuid(),
  constellation text not null,
  body text not null,
  posted_at timestamptz not null default now(),
  constraint constellation_len check (char_length(constellation) <= 120),
  constraint body_len check (char_length(body) <= 8000)
);

alter table public.void_posts enable row level security;

create policy "void_posts_select_public"
  on public.void_posts for select
  using (true);

create policy "void_posts_insert_public"
  on public.void_posts for insert
  with check (true);
