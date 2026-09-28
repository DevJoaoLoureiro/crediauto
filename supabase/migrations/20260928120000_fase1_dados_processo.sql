-- =========================================================
-- FASE 1 — DADOS DO PROCESSO
--
-- • Tipo de crédito (auto, pessoal, habitação)
-- • Viatura importada
-- • Fornecedor do bem (stand)
-- • Equipa por processo: comercial, assistente, administrativo F
-- • Intervenientes: 1.º titular, 2.º titular, avalista, outro
-- • Histórico de eventos (base das estatísticas)
--
-- Idempotente: pode ser executada mais do que uma vez.
-- Executar no Supabase → SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- UTILITÁRIO: updated_at automático
-- ---------------------------------------------------------

create or replace function public.crediauto_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- TIPO DE CRÉDITO
-- ---------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'credit_type') then
    create type public.credit_type as enum ('auto', 'personal', 'housing');
  end if;

  if not exists (select 1 from pg_type where typname = 'participant_role') then
    create type public.participant_role as enum (
      'primary_holder',
      'second_holder',
      'guarantor',
      'other'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------
-- FORNECEDORES (stands / fornecedores do bem)
-- ---------------------------------------------------------

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nif varchar(9),
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_name_idx
  on public.suppliers (name);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.crediauto_set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_select_authenticated" on public.suppliers;
create policy "suppliers_select_authenticated"
  on public.suppliers for select
  to authenticated
  using (true);

drop policy if exists "suppliers_insert_authenticated" on public.suppliers;
create policy "suppliers_insert_authenticated"
  on public.suppliers for insert
  to authenticated
  with check (true);

drop policy if exists "suppliers_update_authenticated" on public.suppliers;
create policy "suppliers_update_authenticated"
  on public.suppliers for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------
-- NOVAS COLUNAS NO PROCESSO
-- ---------------------------------------------------------

alter table public.credit_processes
  add column if not exists credit_type public.credit_type not null default 'auto',
  add column if not exists vehicle_imported boolean not null default false,
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null,
  add column if not exists commercial_id uuid references public.profiles (id) on delete set null,
  add column if not exists assistant_id uuid references public.profiles (id) on delete set null,
  add column if not exists administrative_id uuid references public.profiles (id) on delete set null;

create index if not exists credit_processes_supplier_idx
  on public.credit_processes (supplier_id);

create index if not exists credit_processes_commercial_idx
  on public.credit_processes (commercial_id);

create index if not exists credit_processes_assistant_idx
  on public.credit_processes (assistant_id);

create index if not exists credit_processes_created_at_idx
  on public.credit_processes (created_at desc);

-- ---------------------------------------------------------
-- PERFIS: a equipa precisa de ver os colegas para os
-- poder atribuir aos processos (comercial, assistente...).
-- ---------------------------------------------------------

drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team"
  on public.profiles for select
  to authenticated
  using (true);

-- ---------------------------------------------------------
-- PROCESSOS: permitir editar
--
-- Até agora a app nunca fazia UPDATE em credit_processes.
-- Se ainda não existir política de UPDATE, criamos uma com
-- a MESMA regra de acesso da política de leitura existente.
-- ---------------------------------------------------------

do $$
declare
  read_rule text;
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'credit_processes'
      and cmd in ('UPDATE', 'ALL')
  ) then
    select qual into read_rule
    from pg_policies
    where schemaname = 'public'
      and tablename = 'credit_processes'
      and cmd = 'SELECT'
    limit 1;

    if read_rule is null then
      raise exception 'credit_processes não tem política SELECT; revê o RLS antes de continuar.';
    end if;

    execute format(
      'create policy "credit_processes_update_same_as_select" on public.credit_processes for update to authenticated using (%s) with check (%s)',
      read_rule,
      read_rule
    );
  end if;
end;
$$;

-- ---------------------------------------------------------
-- INTERVENIENTES DO PROCESSO
-- ---------------------------------------------------------

create table if not exists public.process_participants (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.credit_processes (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  role public.participant_role not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (process_id, client_id)
);

-- Só um 1.º titular e um 2.º titular por processo.
create unique index if not exists process_participants_one_primary
  on public.process_participants (process_id)
  where role = 'primary_holder';

create unique index if not exists process_participants_one_second
  on public.process_participants (process_id)
  where role = 'second_holder';

create index if not exists process_participants_client_idx
  on public.process_participants (client_id);

alter table public.process_participants enable row level security;

-- O acesso segue o acesso ao processo (RLS de credit_processes).
drop policy if exists "process_participants_select" on public.process_participants;
create policy "process_participants_select"
  on public.process_participants for select
  to authenticated
  using (exists (
    select 1 from public.credit_processes p
    where p.id = process_participants.process_id
  ));

drop policy if exists "process_participants_insert" on public.process_participants;
create policy "process_participants_insert"
  on public.process_participants for insert
  to authenticated
  with check (exists (
    select 1 from public.credit_processes p
    where p.id = process_participants.process_id
  ));

drop policy if exists "process_participants_delete" on public.process_participants;
create policy "process_participants_delete"
  on public.process_participants for delete
  to authenticated
  using (
    role <> 'primary_holder'
    and exists (
      select 1 from public.credit_processes p
      where p.id = process_participants.process_id
    )
  );

-- Processos existentes: o cliente atual passa a 1.º titular.
insert into public.process_participants (process_id, client_id, role, created_by)
select p.id, p.client_id, 'primary_holder', p.manager_id
from public.credit_processes p
where not exists (
  select 1 from public.process_participants pp
  where pp.process_id = p.id
    and pp.role = 'primary_holder'
)
on conflict do nothing;

-- ---------------------------------------------------------
-- HISTÓRICO DE EVENTOS
--
-- Registo imutável do que acontece em cada processo.
-- É a base das estatísticas (tempos, conversões, vendas).
-- ---------------------------------------------------------

create table if not exists public.process_events (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.credit_processes (id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists process_events_process_idx
  on public.process_events (process_id, created_at);

create index if not exists process_events_type_idx
  on public.process_events (type, created_at);

alter table public.process_events enable row level security;

drop policy if exists "process_events_select" on public.process_events;
create policy "process_events_select"
  on public.process_events for select
  to authenticated
  using (exists (
    select 1 from public.credit_processes p
    where p.id = process_events.process_id
  ));

drop policy if exists "process_events_insert" on public.process_events;
create policy "process_events_insert"
  on public.process_events for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.credit_processes p
      where p.id = process_events.process_id
    )
  );

-- Eventos iniciais para processos já existentes.
insert into public.process_events (process_id, type, created_by, created_at)
select p.id, 'process_created', p.manager_id, p.created_at
from public.credit_processes p
where not exists (
  select 1 from public.process_events e
  where e.process_id = p.id
    and e.type = 'process_created'
);

insert into public.process_events (process_id, type, data, created_at)
select d.process_id, 'rgpd_signed', jsonb_build_object('client_id', d.client_id, 'document_id', d.id), d.signed_at
from public.documents d
where d.type = 'rgpd'
  and d.status = 'signed'
  and d.signed_at is not null
  and not exists (
    select 1 from public.process_events e
    where e.type = 'rgpd_signed'
      and e.data ->> 'document_id' = d.id::text
  );
