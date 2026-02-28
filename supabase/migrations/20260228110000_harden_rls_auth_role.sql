-- Harden RLS policies by requiring authenticated role explicitly.

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id and (select auth.role()) = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id and (select auth.role()) = 'authenticated')
with check (auth.uid() = id and (select auth.role()) = 'authenticated');

drop policy if exists "search_sessions_select_own" on public.search_sessions;
create policy "search_sessions_select_own"
on public.search_sessions
for select
using (auth.uid() = user_id and (select auth.role()) = 'authenticated');

drop policy if exists "search_sessions_insert_own" on public.search_sessions;
create policy "search_sessions_insert_own"
on public.search_sessions
for insert
with check (auth.uid() = user_id and (select auth.role()) = 'authenticated');

drop policy if exists "search_sessions_update_own" on public.search_sessions;
create policy "search_sessions_update_own"
on public.search_sessions
for update
using (auth.uid() = user_id and (select auth.role()) = 'authenticated')
with check (auth.uid() = user_id and (select auth.role()) = 'authenticated');

drop policy if exists "search_sessions_delete_own" on public.search_sessions;
create policy "search_sessions_delete_own"
on public.search_sessions
for delete
using (auth.uid() = user_id and (select auth.role()) = 'authenticated');

drop policy if exists "search_messages_select_own" on public.search_messages;
create policy "search_messages_select_own"
on public.search_messages
for select
using (auth.uid() = user_id and (select auth.role()) = 'authenticated');

drop policy if exists "search_messages_insert_own" on public.search_messages;
create policy "search_messages_insert_own"
on public.search_messages
for insert
with check (
  auth.uid() = user_id
  and (select auth.role()) = 'authenticated'
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
using (auth.uid() = user_id and (select auth.role()) = 'authenticated')
with check (auth.uid() = user_id and (select auth.role()) = 'authenticated');

drop policy if exists "search_messages_delete_own" on public.search_messages;
create policy "search_messages_delete_own"
on public.search_messages
for delete
using (auth.uid() = user_id and (select auth.role()) = 'authenticated');

