-- SalesIntel AI — core schema, workspace isolation (RLS), roles and credits.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- Every business table carries org_id and is protected by Row Level Security.


-- ───────────────────────────── Plans (credit allowances) ─────────────────────────────
-- Keep in sync with src/config/pricing.ts (marketing display + payment links).
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_cents integer not null default 0,
  monthly_credits integer not null,
  sort integer not null default 0,
  active boolean not null default true
);

insert into public.plans (id, name, price_cents, monthly_credits, sort) values
  ('free',    'Free',    0,    200,   0),
  ('starter', 'Starter', 4700, 4000,  1),
  ('pro',     'Pro',     9700, 11000, 2)
on conflict (id) do update
  set name = excluded.name, price_cents = excluded.price_cents,
      monthly_credits = excluded.monthly_credits, sort = excluded.sort;

-- ───────────────────────────── Identity & workspaces ─────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  job_title text,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  cadence text not null default 'weekly'
    check (cadence in ('daily','weekly','biweekly','monthly','quarterly','biannual','annual')),
  plan_id text not null default 'free' references public.plans(id),
  subscription_status text not null default 'none',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

-- ───────────────────────────── Authorization helpers ─────────────────────────────
create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
                 where m.org_id = _org and m.user_id = auth.uid());
$$;

create or replace function public.has_org_role(_org uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
                 where m.org_id = _org and m.user_id = auth.uid() and m.role = any(_roles));
$$;

-- ───────────────────────────── Credits ─────────────────────────────
create table if not exists public.credit_balances (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  allocated integer not null default 0,
  used integer not null default 0 check (used >= 0),
  period_start timestamptz not null default now(),
  period_end timestamptz not null default (now() + interval '1 month'),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  kind text not null check (kind in ('grant','usage','refund','adjustment')),
  operation text,
  amount integer not null,            -- negative = credits consumed, positive = granted/refunded
  balance_after integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_tx_org_idx on public.credit_transactions(org_id, created_at desc);

-- ───────────────────────────── Revenue data ─────────────────────────────
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  kind text not null default 'open' check (kind in ('open','won','lost')),
  probability integer check (probability between 0 and 100),
  unique (org_id, name),
  unique (org_id, id)
);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity text not null check (entity in ('opportunities','accounts','leads','activities')),
  filename text not null,
  storage_path text,
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','completed','failed')),
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  error_rows integer not null default 0,
  headers jsonb not null default '[]'::jsonb,
  mapping jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (org_id, id)
);

create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  region text,
  user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, id)
);
create unique index if not exists sales_reps_name_idx on public.sales_reps(org_id, lower(name));

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  industry text,
  region text,
  size_band text,
  website text,
  status text not null default 'prospect'
    check (status in ('prospect','customer','dormant','churned')),
  owner_rep_id uuid,
  contact_name text,
  contact_email text,
  last_interaction_at timestamptz,
  notes text,
  import_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, owner_rep_id) references public.sales_reps(org_id, id) on delete set null (owner_rep_id),
  foreign key (org_id, import_id) references public.imports(org_id, id) on delete set null (import_id)
);
create unique index if not exists accounts_name_idx on public.accounts(org_id, lower(name));

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  title text,
  industry text,
  size_band text,
  region text,
  source text,
  status text not null default 'new'
    check (status in ('new','contacted','qualified','unqualified','converted')),
  owner_rep_id uuid,
  account_id uuid,
  score integer check (score between 0 and 100),
  score_reason text,
  notes text,
  last_contacted_at timestamptz,
  import_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, owner_rep_id) references public.sales_reps(org_id, id) on delete set null (owner_rep_id),
  foreign key (org_id, account_id) references public.accounts(org_id, id) on delete set null (account_id),
  foreign key (org_id, import_id) references public.imports(org_id, id) on delete set null (import_id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null,
  name text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  stage_id uuid,
  status text not null default 'open' check (status in ('open','won','lost')),
  probability integer check (probability between 0 and 100),
  owner_rep_id uuid,
  product text,
  region text,
  motion text,
  expected_close_date date,
  created_on date not null default current_date,
  closed_at date,
  last_activity_at timestamptz,
  loss_reason text,
  notes text,
  import_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, account_id) references public.accounts(org_id, id) on delete cascade,
  foreign key (org_id, stage_id) references public.pipeline_stages(org_id, id) on delete set null (stage_id),
  foreign key (org_id, owner_rep_id) references public.sales_reps(org_id, id) on delete set null (owner_rep_id),
  foreign key (org_id, import_id) references public.imports(org_id, id) on delete set null (import_id)
);
create index if not exists opps_org_status_idx on public.opportunities(org_id, status);
create index if not exists opps_account_idx on public.opportunities(account_id);

create table if not exists public.opportunity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  kind text not null check (kind in ('created','stage_change','amount_change','status_change')),
  from_value text,
  to_value text,
  amount numeric(14,2),
  created_at timestamptz not null default now()
);
create index if not exists opp_events_org_idx on public.opportunity_events(org_id, created_at desc);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid,
  opportunity_id uuid,
  rep_id uuid,
  kind text not null default 'note' check (kind in ('call','email','meeting','note','other')),
  subject text,
  occurred_at timestamptz not null default now(),
  import_id uuid,
  created_at timestamptz not null default now(),
  foreign key (org_id, account_id) references public.accounts(org_id, id) on delete cascade,
  foreign key (org_id, opportunity_id) references public.opportunities(org_id, id) on delete cascade,
  foreign key (org_id, rep_id) references public.sales_reps(org_id, id) on delete set null (rep_id),
  foreign key (org_id, import_id) references public.imports(org_id, id) on delete set null (import_id)
);
create index if not exists activities_org_idx on public.activities(org_id, occurred_at desc);

-- ───────────────────────────── Conversations ─────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid,
  opportunity_id uuid,
  lead_id uuid,
  title text not null,
  source_type text not null default 'transcript' check (source_type in ('transcript','audio','notes')),
  content text,
  file_path text,
  occurred_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','analyzed','failed')),
  error text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, account_id) references public.accounts(org_id, id) on delete set null (account_id),
  foreign key (org_id, opportunity_id) references public.opportunities(org_id, id) on delete set null (opportunity_id),
  foreign key (org_id, lead_id) references public.leads(org_id, id) on delete set null (lead_id)
);
create index if not exists conversations_org_idx on public.conversations(org_id, occurred_at desc);

create table if not exists public.conversation_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null unique,
  summary text,
  intent text,
  sentiment text check (sentiment in ('positive','neutral','negative','mixed')),
  objections jsonb not null default '[]'::jsonb,
  commitments jsonb not null default '[]'::jsonb,
  competitors jsonb not null default '[]'::jsonb,
  decision_criteria jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_action text,
  follow_up_required boolean not null default false,
  follow_up_by date,
  model text,
  created_at timestamptz not null default now(),
  foreign key (org_id, conversation_id) references public.conversations(org_id, id) on delete cascade
);

-- ───────────────────────────── Intelligence & actions ─────────────────────────────
create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cadence text not null check (cadence in ('daily','weekly','biweekly','monthly','quarterly','biannual','annual')),
  period_start date not null,
  period_end date not null,
  compare_start date,
  compare_end date,
  title text not null,
  summary text,
  report jsonb not null default '{}'::jsonb,
  strategy jsonb not null default '{}'::jsonb,
  next_checks jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('completed','failed')),
  generated_by uuid references auth.users(id),
  credits_used integer not null default 0,
  model text,
  search_text text,
  created_at timestamptz not null default now(),
  unique (org_id, id)
);
create index if not exists briefings_org_idx on public.briefings(org_id, created_at desc);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  briefing_id uuid,
  account_id uuid,
  opportunity_id uuid,
  conversation_id uuid,
  lead_id uuid,
  title text not null,
  description text,
  reason text,
  expected_outcome text,
  definition_of_done text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','done','dismissed')),
  owner_rep_id uuid,
  due_date date,
  source text not null default 'manual' check (source in ('briefing','conversation','follow_up','manual','system')),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, briefing_id) references public.briefings(org_id, id) on delete set null (briefing_id),
  foreign key (org_id, account_id) references public.accounts(org_id, id) on delete set null (account_id),
  foreign key (org_id, opportunity_id) references public.opportunities(org_id, id) on delete set null (opportunity_id),
  foreign key (org_id, conversation_id) references public.conversations(org_id, id) on delete set null (conversation_id),
  foreign key (org_id, lead_id) references public.leads(org_id, id) on delete set null (lead_id),
  foreign key (org_id, owner_rep_id) references public.sales_reps(org_id, id) on delete set null (owner_rep_id)
);
create index if not exists actions_org_idx on public.actions(org_id, status, due_date);

create table if not exists public.action_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  action_id uuid not null,
  user_id uuid references auth.users(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (org_id, action_id) references public.actions(org_id, id) on delete cascade
);

create table if not exists public.follow_up_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid,
  lead_id uuid,
  action_id uuid,
  conversation_id uuid,
  recipient text,
  reason text,
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','copied','discarded')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (org_id, account_id) references public.accounts(org_id, id) on delete set null (account_id),
  foreign key (org_id, lead_id) references public.leads(org_id, id) on delete set null (lead_id),
  foreign key (org_id, action_id) references public.actions(org_id, id) on delete set null (action_id),
  foreign key (org_id, conversation_id) references public.conversations(org_id, id) on delete set null (conversation_id)
);

create table if not exists public.ai_queries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  question text not null,
  answer text,
  supporting jsonb not null default '{}'::jsonb,
  credits_used integer not null default 0,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists ai_queries_org_idx on public.ai_queries(org_id, created_at desc);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  event text not null,
  entity text,
  entity_id uuid,
  summary text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_org_idx on public.activity_logs(org_id, created_at desc);

-- ───────────────────────────── Triggers ─────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['accounts','leads','opportunities','actions'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- New auth user -> profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Opportunity stage -> status/probability/closed date; and change events
create or replace function public.sync_opportunity() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if new.stage_id is not null then
    select kind, probability into s from public.pipeline_stages
      where id = new.stage_id and org_id = new.org_id;
    if found then
      new.status := s.kind;
      if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
        if new.probability is null or tg_op = 'UPDATE' then
          new.probability := coalesce(s.probability, new.probability);
        end if;
      end if;
    end if;
  end if;
  if new.status in ('won','lost') and new.closed_at is null then
    new.closed_at := current_date;
  elsif new.status = 'open' then
    new.closed_at := null;
  end if;
  if tg_op = 'INSERT' and new.last_activity_at is null and new.import_id is null then
    new.last_activity_at := now();
  elsif tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id
        and new.last_activity_at is not distinct from old.last_activity_at then
    new.last_activity_at := now();
  end if;
  return new;
end; $$;

drop trigger if exists opp_sync on public.opportunities;
create trigger opp_sync before insert or update on public.opportunities
  for each row execute function public.sync_opportunity();

create or replace function public.log_opportunity_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; b text;
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_events (org_id, opportunity_id, kind, to_value, amount)
    values (new.org_id, new.id, 'created', new.status, new.amount);
  else
    if new.stage_id is distinct from old.stage_id then
      select name into a from public.pipeline_stages where id = old.stage_id;
      select name into b from public.pipeline_stages where id = new.stage_id;
      insert into public.opportunity_events (org_id, opportunity_id, kind, from_value, to_value, amount)
      values (new.org_id, new.id, 'stage_change', a, b, new.amount);
    end if;
    if new.amount is distinct from old.amount then
      insert into public.opportunity_events (org_id, opportunity_id, kind, from_value, to_value, amount)
      values (new.org_id, new.id, 'amount_change', old.amount::text, new.amount::text, new.amount);
    end if;
    if new.status is distinct from old.status then
      insert into public.opportunity_events (org_id, opportunity_id, kind, from_value, to_value, amount)
      values (new.org_id, new.id, 'status_change', old.status, new.status, new.amount);
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists opp_events on public.opportunities;
create trigger opp_events after insert or update on public.opportunities
  for each row execute function public.log_opportunity_events();

-- Actions: completed_at bookkeeping
create or replace function public.sync_action() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end; $$;
drop trigger if exists action_sync on public.actions;
create trigger action_sync before insert or update on public.actions
  for each row execute function public.sync_action();

-- Audit trail (written by the database so it cannot be skipped by a client)
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare _org uuid; _id uuid; sm text; ev text := lower(tg_op); j jsonb;
begin
  j := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  _org := (j->>'org_id')::uuid;
  _id := case when tg_table_name = 'organization_members' then null else (j->>'id')::uuid end;
  if tg_table_name = 'actions' then
    if tg_op = 'UPDATE' then
      if new.status is not distinct from old.status then return null; end if;
      sm := 'Action "' || new.title || '" marked ' || new.status;
    elsif tg_op = 'INSERT' then sm := 'Action created: ' || (j->>'title');
    else sm := 'Action deleted: ' || (j->>'title'); end if;
  elsif tg_table_name = 'briefings' then
    sm := case tg_op when 'INSERT' then 'Briefing generated: ' else 'Briefing deleted: ' end || (j->>'title');
  elsif tg_table_name = 'conversations' then
    if tg_op = 'INSERT' then sm := 'Conversation added: ' || (j->>'title');
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      sm := 'Conversation ' || new.status || ': ' || new.title;
    elsif tg_op = 'DELETE' then sm := 'Conversation deleted: ' || (j->>'title');
    else return null; end if;
  elsif tg_table_name = 'imports' then
    if tg_op = 'INSERT' then sm := 'Import uploaded: ' || (j->>'filename');
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      sm := 'Import ' || new.status || ': ' || new.filename || ' (' || new.imported_rows || ' rows)';
    else return null; end if;
  elsif tg_table_name = 'organization_members' then
    sm := case tg_op when 'INSERT' then 'Team member joined as ' || (j->>'role')
                     when 'UPDATE' then 'Team member role changed to ' || (j->>'role')
                     else 'Team member removed' end;
  elsif tg_op = 'DELETE' then
    sm := initcap(replace(tg_table_name, 's', '')) || ' deleted: ' || coalesce(j->>'name', '');
  else
    return null;
  end if;
  insert into public.activity_logs (org_id, user_id, event, entity, entity_id, summary)
  values (_org, auth.uid(), tg_table_name || '.' || ev, tg_table_name, _id, sm);
  return null;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['actions','briefings','conversations','imports','organization_members','accounts','opportunities','leads'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.log_activity()', t);
  end loop;
end $$;

-- ───────────────────────────── Workspace functions ─────────────────────────────
create or replace function public.create_organization(_name text, _cadence text default 'weekly')
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); oid uuid; allocation integer; rep_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if (select count(*) from public.organization_members where user_id = uid and role = 'owner') >= 3 then
    raise exception 'Workspace limit reached';
  end if;
  insert into public.organizations (name, cadence, created_by)
    values (trim(_name), coalesce(_cadence, 'weekly'), uid) returning id into oid;
  insert into public.organization_members (org_id, user_id, role) values (oid, uid, 'owner');
  select monthly_credits into allocation from public.plans where id = 'free';
  insert into public.credit_balances (org_id, allocated, used, period_start, period_end)
    values (oid, allocation, 0, now(), now() + interval '1 month');
  insert into public.credit_transactions (org_id, user_id, kind, operation, amount, balance_after, meta)
    values (oid, uid, 'grant', 'plan_allocation', allocation, allocation, '{"plan":"free"}'::jsonb);
  insert into public.pipeline_stages (org_id, name, position, kind, probability) values
    (oid, 'Qualification', 1, 'open', 10), (oid, 'Discovery', 2, 'open', 25),
    (oid, 'Proposal', 3, 'open', 50), (oid, 'Negotiation', 4, 'open', 75),
    (oid, 'Closed Won', 5, 'won', 100), (oid, 'Closed Lost', 6, 'lost', 0);
  select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into rep_name from public.profiles where id = uid;
  insert into public.sales_reps (org_id, name, email, user_id)
    select oid, coalesce(rep_name, 'Owner'), email, uid from public.profiles where id = uid
    on conflict do nothing;
  return oid;
end; $$;

-- Join any workspaces the signed-in (verified) email has been invited to.
create or replace function public.accept_pending_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; n integer := 0; inv record; rep_name text;
begin
  if uid is null then return 0; end if;
  select lower(email) into em from auth.users where id = uid and email_confirmed_at is not null;
  if em is null then return 0; end if;
  for inv in select * from public.organization_invites where email = em and status = 'pending' loop
    insert into public.organization_members (org_id, user_id, role)
      values (inv.org_id, uid, inv.role) on conflict do nothing;
    select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into rep_name from public.profiles where id = uid;
    insert into public.sales_reps (org_id, name, email, user_id)
      values (inv.org_id, coalesce(rep_name, em), em, uid)
      on conflict do nothing;
    update public.sales_reps set user_id = uid where org_id = inv.org_id and lower(email) = em and user_id is null;
    update public.organization_invites set status = 'accepted' where id = inv.id;
    n := n + 1;
  end loop;
  return n;
end; $$;

create or replace function public.set_member_role(_org uuid, _user uuid, _role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_org_role(_org, array['owner']) then raise exception 'Only the owner can change roles'; end if;
  if _role not in ('admin','member') then raise exception 'Invalid role'; end if;
  if exists (select 1 from public.organization_members where org_id = _org and user_id = _user and role = 'owner') then
    raise exception 'The owner role cannot be changed';
  end if;
  update public.organization_members set role = _role where org_id = _org and user_id = _user;
end; $$;

create or replace function public.remove_member(_org uuid, _user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target text;
begin
  select role into target from public.organization_members where org_id = _org and user_id = _user;
  if target is null then return; end if;
  if target = 'owner' then raise exception 'The owner cannot be removed'; end if;
  if public.has_org_role(_org, array['owner']) or
     (public.has_org_role(_org, array['admin']) and target = 'member') then
    delete from public.organization_members where org_id = _org and user_id = _user;
    update public.sales_reps set user_id = null where org_id = _org and user_id = _user;
  else
    raise exception 'Not permitted';
  end if;
end; $$;

-- Credits: refresh the monthly allowance when the billing period has rolled over.
create or replace function public.refresh_credits(_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pend timestamptz; pstart timestamptz; alloc integer;
begin
  if not public.is_org_member(_org) then raise exception 'Not permitted'; end if;
  select period_end into pend from public.credit_balances where org_id = _org for update;
  if pend is null or now() < pend then return; end if;
  select p.monthly_credits into alloc from public.organizations o join public.plans p on p.id = o.plan_id where o.id = _org;
  pstart := pend;
  pend := pend + interval '1 month';
  while pend <= now() loop pstart := pend; pend := pend + interval '1 month'; end loop;
  update public.credit_balances
    set allocated = alloc, used = 0, period_start = pstart, period_end = pend, updated_at = now()
    where org_id = _org;
  insert into public.credit_transactions (org_id, kind, operation, amount, balance_after, meta)
    values (_org, 'grant', 'period_refresh', alloc, alloc, '{}'::jsonb);
end; $$;

-- Server-only (service role): atomic credit spend / refund / plan change.
create or replace function public.consume_credits(_org uuid, _user uuid, _operation text, _amount integer, _meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _alloc integer; _used integer; pend timestamptz; pstart timestamptz; plan_alloc integer;
begin
  select allocated, used, period_end into _alloc, _used, pend
    from public.credit_balances where org_id = _org for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_balance'); end if;
  if now() >= pend then
    select p.monthly_credits into plan_alloc from public.organizations o join public.plans p on p.id = o.plan_id where o.id = _org;
    pstart := pend; pend := pend + interval '1 month';
    while pend <= now() loop pstart := pend; pend := pend + interval '1 month'; end loop;
    update public.credit_balances set allocated = plan_alloc, used = 0,
      period_start = pstart, period_end = pend, updated_at = now() where org_id = _org;
    insert into public.credit_transactions (org_id, kind, operation, amount, balance_after)
      values (_org, 'grant', 'period_refresh', plan_alloc, plan_alloc);
    _alloc := plan_alloc; _used := 0;
  end if;
  if _alloc - _used < _amount then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'remaining', _alloc - _used);
  end if;
  update public.credit_balances set used = used + _amount, updated_at = now() where org_id = _org;
  insert into public.credit_transactions (org_id, user_id, kind, operation, amount, balance_after, meta)
    values (_org, _user, 'usage', _operation, -_amount, _alloc - _used - _amount, _meta);
  return jsonb_build_object('ok', true, 'remaining', _alloc - _used - _amount);
end; $$;

create or replace function public.refund_credits(_org uuid, _user uuid, _operation text, _amount integer, _meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _alloc integer; _used integer;
begin
  update public.credit_balances set used = greatest(used - _amount, 0), updated_at = now()
    where org_id = _org returning allocated, used into _alloc, _used;
  insert into public.credit_transactions (org_id, user_id, kind, operation, amount, balance_after, meta)
    values (_org, _user, 'refund', _operation, _amount, _alloc - _used, _meta);
end; $$;

create or replace function public.set_org_plan(_org uuid, _plan text) returns void
language plpgsql security definer set search_path = public as $$
declare alloc integer;
begin
  select monthly_credits into alloc from public.plans where id = _plan and active;
  if alloc is null then raise exception 'Unknown plan'; end if;
  update public.organizations set plan_id = _plan,
    subscription_status = case when _plan = 'free' then 'none' else 'active' end where id = _org;
  update public.credit_balances set allocated = alloc, used = 0,
    period_start = now(), period_end = now() + interval '1 month', updated_at = now()
    where org_id = _org;
  insert into public.credit_transactions (org_id, kind, operation, amount, balance_after, meta)
    values (_org, 'grant', 'plan_change', alloc, alloc, jsonb_build_object('plan', _plan));
end; $$;

revoke all on function public.consume_credits(uuid, uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.set_org_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_credits(uuid, uuid, text, integer, jsonb) to service_role;
grant execute on function public.refund_credits(uuid, uuid, text, integer, jsonb) to service_role;
grant execute on function public.set_org_plan(uuid, text) to service_role;

revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.accept_pending_invites() from public, anon;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.refresh_credits(uuid) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_pending_invites() to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.refresh_credits(uuid) to authenticated;

-- ───────────────────────────── Row Level Security ─────────────────────────────
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.imports enable row level security;
alter table public.sales_reps enable row level security;
alter table public.accounts enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_events enable row level security;
alter table public.activities enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_findings enable row level security;
alter table public.briefings enable row level security;
alter table public.actions enable row level security;
alter table public.action_notes enable row level security;
alter table public.follow_up_drafts enable row level security;
alter table public.ai_queries enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (true);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.organization_members a join public.organization_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, job_title) on public.profiles to authenticated;

drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists orgs_update on public.organizations;
create policy orgs_update on public.organizations for update to authenticated
  using (public.has_org_role(id, array['owner','admin'])) with check (public.has_org_role(id, array['owner','admin']));
revoke insert, update, delete on public.organizations from authenticated, anon;
grant update (name, cadence) on public.organizations to authenticated;

drop policy if exists members_select on public.organization_members;
create policy members_select on public.organization_members for select to authenticated using (public.is_org_member(org_id));
revoke insert, update, delete on public.organization_members from authenticated, anon;

drop policy if exists invites_select on public.organization_invites;
create policy invites_select on public.organization_invites for select to authenticated
  using (public.has_org_role(org_id, array['owner','admin']));
drop policy if exists invites_insert on public.organization_invites;
create policy invites_insert on public.organization_invites for insert to authenticated
  with check (public.has_org_role(org_id, array['owner','admin'])
              and (role = 'member' or public.has_org_role(org_id, array['owner'])));
drop policy if exists invites_delete on public.organization_invites;
create policy invites_delete on public.organization_invites for delete to authenticated
  using (public.has_org_role(org_id, array['owner','admin']));
revoke update on public.organization_invites from authenticated, anon;

drop policy if exists credits_select on public.credit_balances;
create policy credits_select on public.credit_balances for select to authenticated using (public.is_org_member(org_id));
revoke insert, update, delete on public.credit_balances from authenticated, anon;
drop policy if exists credit_tx_select on public.credit_transactions;
create policy credit_tx_select on public.credit_transactions for select to authenticated using (public.is_org_member(org_id));
revoke insert, update, delete on public.credit_transactions from authenticated, anon;

-- Operational tables: members read/write, owners & admins delete.
do $$
declare t text;
begin
  foreach t in array array['sales_reps','accounts','leads','opportunities','activities','conversations',
                           'conversation_findings','actions','action_notes','follow_up_drafts'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_org_member(org_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_org_member(org_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.has_org_role(org_id, array[''owner'',''admin'']))', t);
  end loop;
end $$;

-- Admin-managed structures
drop policy if exists stages_select on public.pipeline_stages;
create policy stages_select on public.pipeline_stages for select to authenticated using (public.is_org_member(org_id));
drop policy if exists stages_write on public.pipeline_stages;
create policy stages_write on public.pipeline_stages for all to authenticated
  using (public.has_org_role(org_id, array['owner','admin'])) with check (public.has_org_role(org_id, array['owner','admin']));

drop policy if exists imports_select on public.imports;
create policy imports_select on public.imports for select to authenticated using (public.is_org_member(org_id));
drop policy if exists imports_write on public.imports;
create policy imports_write on public.imports for all to authenticated
  using (public.has_org_role(org_id, array['owner','admin'])) with check (public.has_org_role(org_id, array['owner','admin']));

-- Briefings & AI history: members create and read; admins manage.
drop policy if exists briefings_select on public.briefings;
create policy briefings_select on public.briefings for select to authenticated using (public.is_org_member(org_id));
drop policy if exists briefings_insert on public.briefings;
create policy briefings_insert on public.briefings for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists briefings_delete on public.briefings;
create policy briefings_delete on public.briefings for delete to authenticated using (public.has_org_role(org_id, array['owner','admin']));

drop policy if exists ai_queries_select on public.ai_queries;
create policy ai_queries_select on public.ai_queries for select to authenticated using (public.is_org_member(org_id));
drop policy if exists ai_queries_insert on public.ai_queries;
create policy ai_queries_insert on public.ai_queries for insert to authenticated
  with check (public.is_org_member(org_id) and user_id = auth.uid());

-- Event/log tables are written by triggers only.
drop policy if exists opp_events_select on public.opportunity_events;
create policy opp_events_select on public.opportunity_events for select to authenticated using (public.is_org_member(org_id));
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select to authenticated using (public.is_org_member(org_id));
revoke insert, update, delete on public.opportunity_events, public.activity_logs from authenticated, anon;

-- Anonymous users get nothing except the plan list.
revoke all on all tables in schema public from anon;
grant select on public.plans to anon, authenticated;

-- ───────────────────────────── Storage (private, org-scoped paths) ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit) values
  ('imports', 'imports', false, 10485760),
  ('conversations', 'conversations', false, 20971520)
on conflict (id) do nothing;

create or replace function public.storage_org(_name text) returns uuid
language sql stable as $$
  select case when (storage.foldername(_name))[1] ~ '^[0-9a-fA-F-]{36}$'
              then ((storage.foldername(_name))[1])::uuid else null end;
$$;

drop policy if exists "org files read" on storage.objects;
create policy "org files read" on storage.objects for select to authenticated
  using (bucket_id in ('imports','conversations') and public.is_org_member(public.storage_org(name)));
drop policy if exists "org files insert" on storage.objects;
create policy "org files insert" on storage.objects for insert to authenticated
  with check (
    (bucket_id = 'conversations' and public.is_org_member(public.storage_org(name)))
    or (bucket_id = 'imports' and public.has_org_role(public.storage_org(name), array['owner','admin'])));
drop policy if exists "org files delete" on storage.objects;
create policy "org files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('imports','conversations') and public.has_org_role(public.storage_org(name), array['owner','admin']));
