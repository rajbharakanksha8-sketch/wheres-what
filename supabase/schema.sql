-- Where's What: run once in Supabase (SQL Editor, or psql with the database connection string).
-- All access goes through the app's server functions using the service role key,
-- so RLS is on with no policies: the public anon key can read or write nothing.

create table if not exists public.boxes (
  code        text primary key check (code ~ '^[A-Z]{3}-[0-9]{2,3}$'),
  cat         text not null,
  name        text not null default '',
  location    text not null default 'Unplaced',
  items       jsonb not null default '[]'::jsonb,
  notes       text not null default '',
  photos      jsonb not null default '[]'::jsonb,
  history     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  locations  jsonb not null default '["Loft","TV unit","Unplaced"]'::jsonb,
  members    jsonb not null default '[]'::jsonb
);

alter table public.boxes enable row level security;
alter table public.settings enable row level security;

insert into public.settings (id, locations, members)
values (1, '["Loft","TV unit","Unplaced"]', '["Akanksha","Kalpak","Rupak"]')
on conflict (id) do nothing;

-- Private photo bucket (served to the app through short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
