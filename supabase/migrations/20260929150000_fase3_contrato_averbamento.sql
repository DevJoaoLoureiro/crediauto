-- =========================================================
-- FASE 3 — CONTRATO, FINANCIAMENTO E AVERBAMENTO
--
-- Aprovado
--   → Assinatura do contrato (banco enviou o contrato;
--     comercial tem 15 dias para devolver o contrato assinado)
--   → Averbamento (45 dias para verificar o averbamento)
--   → Concluído
--
-- Resultado do financiamento: Financiada, Pendente,
-- Financiada com carta de compromisso.
--
-- Requer as migrações das Fases 1 e 2.
-- Idempotente: pode ser executada mais do que uma vez.
-- Executar no Supabase → SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- NOVAS FASES DO PROCESSO
-- ---------------------------------------------------------

alter type public.process_status add value if not exists 'contract_signing' after 'approved';
alter type public.process_status add value if not exists 'registration' after 'contract_signing';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'funding_status') then
    create type public.funding_status as enum (
      'financed',
      'pending',
      'financed_commitment_letter'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------
-- DADOS DO CONTRATO E DO AVERBAMENTO
-- ---------------------------------------------------------

alter table public.credit_processes
  -- Proposta aprovada que segue para contrato (banco X).
  add column if not exists approved_proposal_id uuid
    references public.lender_proposals (id) on delete set null,

  -- Assinatura do contrato: prazo de 15 dias.
  add column if not exists contract_received_on date,
  add column if not exists contract_deadline date,
  add column if not exists contract_resolved_at timestamptz,
  add column if not exists contract_resolved_by uuid
    references public.profiles (id) on delete set null,

  -- Resultado do financiamento.
  add column if not exists funding_status public.funding_status,
  add column if not exists funding_status_at timestamptz,

  -- Averbamento: prazo de 45 dias após o contrato resolvido.
  add column if not exists registration_deadline date,
  add column if not exists registration_verified_on date;

-- Listas de prazos (só processos ainda por resolver).
create index if not exists credit_processes_contract_deadline_idx
  on public.credit_processes (contract_deadline)
  where contract_deadline is not null
    and contract_resolved_at is null;

create index if not exists credit_processes_registration_deadline_idx
  on public.credit_processes (registration_deadline)
  where registration_deadline is not null
    and registration_verified_on is null;
