-- 1. DPDP Sec. 13: make the grievance acknowledgement clock provable.
--    acknowledged_at is stamped when the request lands. The 7-day resolution
--    deadline is derived from it in application code (see lib/dpdp-due.ts).
alter table public.data_requests
  add column if not exists acknowledged_at timestamptz;

update public.data_requests
  set acknowledged_at = created_at
  where acknowledged_at is null;

-- 2. First-touch attribution: which outreach message brought this person.
--    Primary key on user_id makes it write-once, so first touch always wins.
create table public.user_attribution (
  user_id uuid primary key,
  source text not null,
  campaign text,
  referrer text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.user_attribution TO authenticated;
GRANT ALL ON public.user_attribution TO service_role;

ALTER TABLE public.user_attribution ENABLE ROW LEVEL SECURITY;

create policy "own attribution read"
  on public.user_attribution for select to authenticated
  using (auth.uid() = user_id);

create policy "own attribution create"
  on public.user_attribution for insert to authenticated
  with check (auth.uid() = user_id);

-- 3. Daily return visits: proves whether someone came back on their own.
create table public.user_visits (
  user_id uuid not null,
  visited_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, visited_on)
);

GRANT SELECT, INSERT ON public.user_visits TO authenticated;
GRANT ALL ON public.user_visits TO service_role;

ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;

create policy "own visits read"
  on public.user_visits for select to authenticated
  using (auth.uid() = user_id);

create policy "own visits record"
  on public.user_visits for insert to authenticated
  with check (auth.uid() = user_id);