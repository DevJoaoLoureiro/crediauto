-- =========================================================
-- FASE 2 — PROPOSTAS AOS BANCOS
--
-- • Lista de bancos / financeiras
-- • Propostas por processo: em análise, aprovada, recusada (+ motivo)
-- • Documentos adicionais pedidos pelo banco durante a análise
-- • Tarefas / lembretes por processo (ex.: contraproposta →
--   falar com o comercial)
--
-- Requer a migração da Fase 1.
-- Idempotente: pode ser executada mais do que uma vez.
-- Executar no Supabase → SQL Editor.
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposal_status') then
    create type public.proposal_status as enum (
      'in_analysis',
      'approved',
      'rejected'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------
-- BANCOS / FINANCEIRAS
-- ---------------------------------------------------------

create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists banks_name_unique
  on public.banks (lower(name));

drop trigger if exists banks_set_updated_at on public.banks;
create trigger banks_set_updated_at
  before update on public.banks
  for each row execute function public.crediauto_set_updated_at();

alter table public.banks enable row level security;

drop policy if exists "banks_select_authenticated" on public.banks;
create policy "banks_select_authenticated"
  on public.banks for select
  to authenticated
  using (true);

drop policy if exists "banks_insert_authenticated" on public.banks;
create policy "banks_insert_authenticated"
  on public.banks for insert
  to authenticated
  with check (true);

drop policy if exists "banks_update_authenticated" on public.banks;
create policy "banks_update_authenticated"
  on public.banks for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------
-- PROPOSTAS
-- ---------------------------------------------------------

create table if not exists public.lender_proposals (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.credit_processes (id) on delete cascade,
  bank_id uuid not null references public.banks (id) on delete restrict,
  status public.proposal_status not null default 'in_analysis',

  submitted_at timestamptz not null default now(),
  decided_at timestamptz,

  -- Motivo da aprovação/recusa escrito pela equipa.
  reason text,

  -- Condições aprovadas (montante da operação).
  approved_amount numeric(12, 2),
  approved_term_months integer,

  notes text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lender_proposals_amount_positive
    check (approved_amount is null or approved_amount > 0),
  constraint lender_proposals_term_positive
    check (approved_term_months is null or approved_term_months > 0)
);

create index if not exists lender_proposals_process_idx
  on public.lender_proposals (process_id, submitted_at);

create index if not exists lender_proposals_bank_idx
  on public.lender_proposals (bank_id, status);

drop trigger if exists lender_proposals_set_updated_at on public.lender_proposals;
create trigger lender_proposals_set_updated_at
  before update on public.lender_proposals
  for each row execute function public.crediauto_set_updated_at();

alter table public.lender_proposals enable row level security;

drop policy if exists "lender_proposals_select" on public.lender_proposals;
create policy "lender_proposals_select"
  on public.lender_proposals for select
  to authenticated
  using (exists (
    select 1 from public.credit_processes p
    where p.id = lender_proposals.process_id
  ));

drop policy if exists "lender_proposals_insert" on public.lender_proposals;
create policy "lender_proposals_insert"
  on public.lender_proposals for insert
  to authenticated
  with check (exists (
    select 1 from public.credit_processes p
    where p.id = lender_proposals.process_id
  ));

drop policy if exists "lender_proposals_update" on public.lender_proposals;
create policy "lender_proposals_update"
  on public.lender_proposals for update
  to authenticated
  using (exists (
    select 1 from public.credit_processes p
    where p.id = lender_proposals.process_id
  ))
  with check (exists (
    select 1 from public.credit_processes p
    where p.id = lender_proposals.process_id
  ));

-- ---------------------------------------------------------
-- DOCUMENTOS ADICIONAIS PEDIDOS PELO BANCO
-- ---------------------------------------------------------

alter table public.document_requests
  add column if not exists proposal_id uuid
    references public.lender_proposals (id) on delete set null;

create index if not exists document_requests_proposal_idx
  on public.document_requests (proposal_id)
  where proposal_id is not null;

-- ---------------------------------------------------------
-- TAREFAS / LEMBRETES DO PROCESSO
-- ---------------------------------------------------------

create table if not exists public.process_tasks (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.credit_processes (id) on delete cascade,

  title text not null,
  description text,

  -- Origem: manual, counter_proposal, ...
  kind text not null default 'manual',

  assigned_to uuid references public.profiles (id) on delete set null,
  due_date date,

  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists process_tasks_process_idx
  on public.process_tasks (process_id, created_at);

create index if not exists process_tasks_open_idx
  on public.process_tasks (due_date)
  where done_at is null;

drop trigger if exists process_tasks_set_updated_at on public.process_tasks;
create trigger process_tasks_set_updated_at
  before update on public.process_tasks
  for each row execute function public.crediauto_set_updated_at();

alter table public.process_tasks enable row level security;

drop policy if exists "process_tasks_select" on public.process_tasks;
create policy "process_tasks_select"
  on public.process_tasks for select
  to authenticated
  using (exists (
    select 1 from public.credit_processes p
    where p.id = process_tasks.process_id
  ));

drop policy if exists "process_tasks_insert" on public.process_tasks;
create policy "process_tasks_insert"
  on public.process_tasks for insert
  to authenticated
  with check (exists (
    select 1 from public.credit_processes p
    where p.id = process_tasks.process_id
  ));

drop policy if exists "process_tasks_update" on public.process_tasks;
create policy "process_tasks_update"
  on public.process_tasks for update
  to authenticated
  using (exists (
    select 1 from public.credit_processes p
    where p.id = process_tasks.process_id
  ))
  with check (exists (
    select 1 from public.credit_processes p
    where p.id = process_tasks.process_id
  ));
