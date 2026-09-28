'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { logProcessEvent } from '@/lib/crm/events';
import {
  PROPOSAL_STATUSES,
  type ProposalStatus,
} from '@/lib/crm/labels';

type ActionResult =
  | { success: true }
  | { success: false; message: string };

/*
 * Estados do processo que as propostas podem alterar
 * automaticamente. Fases posteriores (contrato, financiada...)
 * nunca são recuadas por aqui.
 */
const AUTO_STATUS_SOURCES = [
  'new',
  'documentation',
  'ready_for_analysis',
  'sent_to_lender',
  'under_analysis',
  'approved',
  'rejected',
];

async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

async function loadProcess(supabase: SupabaseClient, processId: string) {
  const { data } = await supabase
    .from('credit_processes')
    .select('id, status, client_id, credit_type, commercial_id, vehicle_make, vehicle_model, vehicle_version, vehicle_year, vehicle_registration, vehicle_price')
    .eq('id', processId)
    .maybeSingle();

  return data;
}

function refresh(processId: string) {
  revalidatePath(`/processos/${processId}`);
  revalidatePath('/processos');
  revalidatePath('/dashboard');
}

/* =========================================================
   ESTADO DO PROCESSO A PARTIR DAS PROPOSTAS

   Alguma aprovada  -> Aprovado
   Alguma em análise -> Em análise
   Todas recusadas   -> Recusado
========================================================= */

async function syncProcessStatus(
  supabase: SupabaseClient,
  processId: string,
  currentStatus: string,
  userId: string,
) {
  if (!AUTO_STATUS_SOURCES.includes(currentStatus)) {
    return;
  }

  const { data: proposals } = await supabase
    .from('lender_proposals')
    .select('status')
    .eq('process_id', processId);

  const statuses = (proposals ?? []).map((proposal) => proposal.status);

  if (statuses.length === 0) {
    return;
  }

  const target = statuses.includes('approved')
    ? 'approved'
    : statuses.includes('in_analysis')
      ? 'under_analysis'
      : 'rejected';

  if (target === currentStatus) {
    return;
  }

  const { error } = await supabase
    .from('credit_processes')
    .update({ status: target })
    .eq('id', processId);

  if (error) {
    console.error('Erro ao atualizar estado do processo:', error);
    return;
  }

  await logProcessEvent(supabase, {
    processId,
    type: 'process_status_changed',
    data: { from: currentStatus, to: target, source: 'proposals' },
    createdBy: userId,
  });
}

/* =========================================================
   ENVIAR PROPOSTA A UM BANCO
========================================================= */

export async function createProposalAction(
  processId: string,
  input: { bankId: string; notes: string },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  const creditProcess = await loadProcess(supabase, processId);

  if (!creditProcess) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  const { data: bank } = await supabase
    .from('banks')
    .select('id, name')
    .eq('id', input.bankId)
    .maybeSingle();

  if (!bank) {
    return { success: false, message: 'Seleciona um banco válido.' };
  }

  const { data: proposal, error } = await supabase
    .from('lender_proposals')
    .insert({
      process_id: creditProcess.id,
      bank_id: bank.id,
      status: 'in_analysis',
      notes: input.notes.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !proposal) {
    console.error('Erro ao criar proposta:', error);

    return {
      success: false,
      message: 'Não foi possível registar a proposta.',
    };
  }

  await logProcessEvent(supabase, {
    processId: creditProcess.id,
    type: 'proposal_submitted',
    data: {
      proposal_id: proposal.id,
      bank_id: bank.id,
      bank_name: bank.name,
    },
    createdBy: user.id,
  });

  await syncProcessStatus(
    supabase,
    creditProcess.id,
    creditProcess.status,
    user.id,
  );

  refresh(creditProcess.id);

  return { success: true };
}

/* =========================================================
   DECISÃO DO BANCO
========================================================= */

export async function decideProposalAction(
  processId: string,
  proposalId: string,
  input: {
    status: ProposalStatus;
    reason: string;
    approvedAmount: string;
    approvedTermMonths: string;
  },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  if (!PROPOSAL_STATUSES.includes(input.status)) {
    return { success: false, message: 'Estado inválido.' };
  }

  const reason = input.reason.trim();

  if (input.status === 'rejected' && !reason) {
    return {
      success: false,
      message: 'Indica o motivo da recusa.',
    };
  }

  const approvedAmount = input.approvedAmount.trim()
    ? Number(input.approvedAmount.replace(',', '.'))
    : null;

  const approvedTerm = input.approvedTermMonths.trim()
    ? Number.parseInt(input.approvedTermMonths, 10)
    : null;

  if (
    approvedAmount !== null &&
    (!Number.isFinite(approvedAmount) || approvedAmount <= 0)
  ) {
    return { success: false, message: 'Montante aprovado inválido.' };
  }

  if (
    approvedTerm !== null &&
    (!Number.isFinite(approvedTerm) || approvedTerm <= 0)
  ) {
    return { success: false, message: 'Prazo aprovado inválido.' };
  }

  const creditProcess = await loadProcess(supabase, processId);

  if (!creditProcess) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  const { data: previous } = await supabase
    .from('lender_proposals')
    .select('id, status, bank_id, banks ( name )')
    .eq('id', proposalId)
    .eq('process_id', creditProcess.id)
    .maybeSingle();

  if (!previous) {
    return { success: false, message: 'Proposta não encontrada.' };
  }

  const isApproved = input.status === 'approved';

  const { error } = await supabase
    .from('lender_proposals')
    .update({
      status: input.status,
      reason: reason || null,
      decided_at:
        input.status === 'in_analysis' ? null : new Date().toISOString(),
      approved_amount: isApproved ? approvedAmount : null,
      approved_term_months: isApproved ? approvedTerm : null,
    })
    .eq('id', previous.id);

  if (error) {
    console.error('Erro ao atualizar proposta:', error);

    return {
      success: false,
      message: 'Não foi possível guardar a decisão.',
    };
  }

  if (previous.status !== input.status) {
    const bank = Array.isArray(previous.banks)
      ? previous.banks[0]
      : previous.banks;

    await logProcessEvent(supabase, {
      processId: creditProcess.id,
      type: 'proposal_decided',
      data: {
        proposal_id: previous.id,
        bank_id: previous.bank_id,
        bank_name: bank?.name ?? null,
        from: previous.status,
        to: input.status,
        reason: reason || null,
      },
      createdBy: user.id,
    });
  }

  await syncProcessStatus(
    supabase,
    creditProcess.id,
    creditProcess.status,
    user.id,
  );

  refresh(creditProcess.id);

  return { success: true };
}

/* =========================================================
   DOCUMENTOS ADICIONAIS PEDIDOS PELO BANCO

   Ficam como pedidos normais no portal do cliente,
   associados à proposta.
========================================================= */

export async function requestProposalDocumentsAction(
  processId: string,
  proposalId: string,
  items: {
    label: string;
    instructions: string;
    quantity: number;
  }[],
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  const creditProcess = await loadProcess(supabase, processId);

  if (!creditProcess) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  const { data: proposal } = await supabase
    .from('lender_proposals')
    .select('id, bank_id, banks ( name )')
    .eq('id', proposalId)
    .eq('process_id', creditProcess.id)
    .maybeSingle();

  if (!proposal) {
    return { success: false, message: 'Proposta não encontrada.' };
  }

  const normalized = items
    .map((item) => ({
      label: item.label.trim(),
      instructions: item.instructions.trim() || null,
      quantity: Math.max(1, Math.min(12, Math.floor(item.quantity || 1))),
    }))
    .filter((item) => item.label.length > 0);

  if (!normalized.length) {
    return {
      success: false,
      message: 'Indica pelo menos um documento.',
    };
  }

  const { data: existing } = await supabase
    .from('document_requests')
    .select('label')
    .eq('proposal_id', proposal.id)
    .neq('status', 'cancelled');

  const existingLabels = new Set(
    (existing ?? []).map((request) => request.label.toLowerCase()),
  );

  const rows = normalized
    .filter((item) => !existingLabels.has(item.label.toLowerCase()))
    .map((item) => ({
      process_id: creditProcess.id,
      client_id: creditProcess.client_id,
      proposal_id: proposal.id,
      type: 'other' as const,
      label: item.label,
      instructions: item.instructions,
      quantity_required: item.quantity,
      status: 'pending' as const,
      created_by: user.id,
    }));

  if (!rows.length) {
    return {
      success: false,
      message: 'Esses documentos já foram pedidos para esta proposta.',
    };
  }

  const { error } = await supabase.from('document_requests').insert(rows);

  if (error) {
    console.error('Erro ao pedir documentos adicionais:', error);

    return {
      success: false,
      message: 'Não foi possível criar os pedidos.',
    };
  }

  const bank = Array.isArray(proposal.banks)
    ? proposal.banks[0]
    : proposal.banks;

  await logProcessEvent(supabase, {
    processId: creditProcess.id,
    type: 'proposal_documents_requested',
    data: {
      proposal_id: proposal.id,
      bank_name: bank?.name ?? null,
      labels: rows.map((row) => row.label),
    },
    createdBy: user.id,
  });

  refresh(creditProcess.id);

  return { success: true };
}

/* =========================================================
   CONTRAPROPOSTA

   Proposta recusada → atribuir outra viatura e criar
   lembrete para falar com o comercial.
========================================================= */

export async function counterProposalAction(
  processId: string,
  proposalId: string,
  input: {
    vehicleMake: string;
    vehicleModel: string;
    vehicleVersion: string;
    vehicleYear: string;
    vehicleRegistration: string;
    vehiclePrice: string;
    dueDate: string;
    note: string;
  },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  const creditProcess = await loadProcess(supabase, processId);

  if (!creditProcess) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  const { data: proposal } = await supabase
    .from('lender_proposals')
    .select('id, status')
    .eq('id', proposalId)
    .eq('process_id', creditProcess.id)
    .maybeSingle();

  if (!proposal || proposal.status !== 'rejected') {
    return {
      success: false,
      message: 'A contraproposta só se aplica a propostas recusadas.',
    };
  }

  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { success: false, message: 'Data do lembrete inválida.' };
  }

  const text = (value: string) => value.trim() || null;

  const vehicleYear = input.vehicleYear.trim()
    ? Number.parseInt(input.vehicleYear, 10)
    : null;

  const vehiclePrice = input.vehiclePrice.trim()
    ? Number(input.vehiclePrice.replace(',', '.'))
    : null;

  if (vehiclePrice !== null && (!Number.isFinite(vehiclePrice) || vehiclePrice < 0)) {
    return { success: false, message: 'Preço da viatura inválido.' };
  }

  /*
   * Nova viatura (só no crédito auto).
   */
  let newVehicle: Record<string, unknown> | null = null;

  if (creditProcess.credit_type === 'auto' && text(input.vehicleMake)) {
    newVehicle = {
      vehicle_make: text(input.vehicleMake),
      vehicle_model: text(input.vehicleModel),
      vehicle_version: text(input.vehicleVersion),
      vehicle_year: Number.isFinite(vehicleYear) ? vehicleYear : null,
      vehicle_registration: text(input.vehicleRegistration),
      vehicle_price: vehiclePrice,
    };

    const { error: vehicleError } = await supabase
      .from('credit_processes')
      .update(newVehicle)
      .eq('id', creditProcess.id);

    if (vehicleError) {
      console.error('Erro ao atribuir nova viatura:', vehicleError);

      return {
        success: false,
        message: 'Não foi possível atribuir a nova viatura.',
      };
    }
  }

  /*
   * Lembrete para o comercial.
   */
  const { error: taskError } = await supabase.from('process_tasks').insert({
    process_id: creditProcess.id,
    kind: 'counter_proposal',
    title: 'Contraproposta: falar com o comercial',
    description: text(input.note),
    assigned_to: creditProcess.commercial_id,
    due_date: input.dueDate || null,
    created_by: user.id,
  });

  if (taskError) {
    console.error('Erro ao criar lembrete:', taskError);

    return {
      success: false,
      message: 'Não foi possível criar o lembrete.',
    };
  }

  await logProcessEvent(supabase, {
    processId: creditProcess.id,
    type: 'counter_proposal',
    data: {
      proposal_id: proposal.id,
      previous_vehicle: newVehicle
        ? {
            vehicle_make: creditProcess.vehicle_make,
            vehicle_model: creditProcess.vehicle_model,
            vehicle_version: creditProcess.vehicle_version,
            vehicle_year: creditProcess.vehicle_year,
            vehicle_registration: creditProcess.vehicle_registration,
            vehicle_price: creditProcess.vehicle_price,
          }
        : null,
      new_vehicle: newVehicle,
    },
    createdBy: user.id,
  });

  refresh(creditProcess.id);
  revalidatePath('/tarefas');

  return { success: true };
}
