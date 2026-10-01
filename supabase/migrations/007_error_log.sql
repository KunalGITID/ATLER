-- Client-side errors, so bugs real users hit are visible. Anyone (even
-- signed out) may insert their own rows; nobody can read them through the
-- API. Read them in the SQL editor or with the query in the README.
create table if not exists public.error_log (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  kind       text not null check (kind in ('error', 'rejection', 'write')),
  message    text not null check (length(message) <= 1000),
  stack      text check (length(stack) <= 4000),
  context    jsonb,
  release    text check (length(release) <= 40),
  url        text check (length(url) <= 500),
  user_agent text check (length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists error_log_created_at_idx on public.error_log (created_at desc);
alter table public.error_log enable row level security;
create policy "anyone can report their own errors" on public.error_log
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
