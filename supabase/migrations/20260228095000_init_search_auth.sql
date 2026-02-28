-- Initial Supabase schema for Ari search app.
-- Includes: profiles, search_sessions, search_messages + strict RLS.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.search_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists search_sessions_user_id_idx
  on public.search_sessions (user_id, created_at desc);

create trigger search_sessions_set_updated_at
before update on public.search_sessions
for each row
execute function public.set_updated_at();

create table if not exists public.search_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.search_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists search_messages_session_id_idx
  on public.search_messages (session_id, created_at asc);

create index if not exists search_messages_user_id_idx
  on public.search_messages (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.search_sessions enable row level security;
alter table public.search_messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "search_sessions_select_own" on public.search_sessions;
create policy "search_sessions_select_own"
on public.search_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "search_sessions_insert_own" on public.search_sessions;
create policy "search_sessions_insert_own"
on public.search_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "search_sessions_update_own" on public.search_sessions;
create policy "search_sessions_update_own"
on public.search_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "search_sessions_delete_own" on public.search_sessions;
create policy "search_sessions_delete_own"
on public.search_sessions
for delete
using (auth.uid() = user_id);

drop policy if exists "search_messages_select_own" on public.search_messages;
create policy "search_messages_select_own"
on public.search_messages
for select
using (auth.uid() = user_id);

drop policy if exists "search_messages_insert_own" on public.search_messages;
create policy "search_messages_insert_own"
on public.search_messages
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.search_sessions s
    where s.id = search_messages.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "search_messages_update_own" on public.search_messages;
create policy "search_messages_update_own"
on public.search_messages
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "search_messages_delete_own" on public.search_messages;
create policy "search_messages_delete_own"
on public.search_messages
for delete
using (auth.uid() = user_id);

