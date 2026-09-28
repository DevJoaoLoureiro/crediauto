'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { logProcessEvent } from '@/lib/crm/events';
import {
  CONTRACT_DEADLINE_DAYS,
  FUNDING_STATUSES,
  REGISTRATION_DEADLINE_DAYS,
  type FundingStatus,
} from '@/lib/crm/labels';
import { addDaysIsoDate, todayIsoDate } from '@/lib/format';

type ActionResult =
  | { success: true }
  | { success: false; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function loadContext(processId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, process: null };
  }

  const { data: process } = await supabase
    .from('credit_processes')
    .select(`
      id,
      status,
      funding_status,
      contract_resolved_at,
      registration_verified_on
    `)
    .eq('id', processId)
    .maybeSingle();

  return { supabase, user, process };
}

function refresh(processId: string) {
  revalidatePath(`/processos/${processId}`);
  revalidatePath('/processos');
  revalidatePath('/prazos');
  revalidatePath('/dashboard');
}

/* =========================================================
   BANCO ENVIOU O CONTRATO

   Aprovado → Assinatura do contrato (prazo 15 dias).
========================================================= */

export async function startContractPhaseAction(
  processId: string,
  input: { proposalId: string; receivedOn: string },
): Promise<ActionResult> {
  const { supabase, user, process } = await loadContext(processId);

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  if (!process) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  if (process.status !== 'approved') {
    return {
      success: false,
      message: 'O contrato só pode ser registado num processo aprovado.',
    };
  }

  if (!ISO_DATE.test(input.receivedOn) || input.receivedOn > todayIsoDate()) {
    return {
      success: false,
      message: 'Indica uma data de receção válida (não futura).',
    };
  }

  const { data: proposal } = await supabase
    .from('lender_proposals')
    .select('id, status, banks ( name )')
    .eq('id', input.proposalId)
    .eq('process_id', process.id)
    .maybeSingle();

  if (!proposal || proposal.status !== 'approved') {
    return {
      success: false,
      message: 'Seleciona uma proposta aprovada deste processo.',
    };
  }

  const deadline = addDaysIsoDate(input.receivedOn, CONTRACT_DEADLINE_DAYS);

  const { error } = await supabase
    .from('credit_processes')
    .update({
      status: 'contract_signing',
      approved_proposal_id: proposal.id,
      contract_received_on: input.receivedOn,
      contract_deadline: deadline,
      contract_resolved_at: null,
      contract_resolved_by: null,
    })
    .eq('id', process.id);

  if (error) {
    console.error('Erro ao registar contrato:', error);

    return {
      success: false,
      message: 'Não foi possível registar o contrato.',
    };
  }

  const bank = Array.isArray(proposal.banks)
    ? proposal.banks[0]
    : proposal.banks;

  await logProcessEvent(supabase, {
    processId: process.id,
    type: 'contract_received',
    data: {
      proposal_id: proposal.id,
      bank_name: bank?.name ?? null,
      received_on: input.receivedOn,
      deadline,
    },
    createdBy: user.id,
  });

  await logProcessEvent(supabase, {
    processId: process.id,
    type: 'process_status_changed',
    data: { from: 'approved', to: 'contract_signing', source: 'contract' },
    createdBy: user.id,
  });

  refresh(process.id);

  return { success: true };
}

/* =========================================================
   CONTRATO ASSINADO ENTREGUE (checkbox "resolvido")

   Assinatura do contrato → Averbamento (prazo 45 dias).
   Desmarcar volta atrás enquanto o averbamento não
   estiver verificado.
========================================================= */

export async function setContractResolvedAction(
  processId: string,
  resolved: boolean,
): Promise<ActionResult> {
  const { supabase, user, process } = await loadContext(processId);

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  if (!process) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  if (resolved) {
    if (process.status !== 'contract_signing') {
      return {
        success: false,
        message: 'O processo não está na fase de assinatura do contrato.',
      };
    }

    const now = new Date();
    const deadline = addDaysIsoDate(
      todayIsoDate(),
      REGISTRATION_DEADLINE_DAYS,
    );

    const { error } = await supabase
      .from('credit_processes')
      .update({
        status: 'registration',
        contract_resolved_at: now.toISOString(),
        contract_resolved_by: user.id,
        registration_deadline: deadline,
        registration_verified_on: null,
        /*
         * Até o banco pagar, o financiamento fica Pendente.
         */
        funding_status: process.funding_status ?? 'pending',
        funding_status_at: process.funding_status
          ? undefined
          : now.toISOString(),
      })
      .eq('id', process.id);

    if (error) {
      console.error('Erro ao resolver contrato:', error);

      return {
        success: false,
        message: 'Não foi possível marcar como resolvido.',
      };
    }

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'contract_resolved',
      data: { registration_deadline: deadline },
      createdBy: user.id,
    });

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'process_status_changed',
      data: { from: 'contract_signing', to: 'registration', source: 'contract' },
      createdBy: user.id,
    });
  } else {
    if (process.status !== 'registration' || process.registration_verified_on) {
      return {
        success: false,
        message:
          'Só é possível reabrir o contrato antes de o averbamento ser verificado.',
      };
    }

    const { error } = await supabase
      .from('credit_processes')
      .update({
        status: 'contract_signing',
        contract_resolved_at: null,
        contract_resolved_by: null,
        registration_deadline: null,
      })
      .eq('id', process.id);

    if (error) {
      console.error('Erro ao reabrir contrato:', error);

      return {
        success: false,
        message: 'Não foi possível reabrir o contrato.',
      };
    }

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'contract_reopened',
      createdBy: user.id,
    });

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'process_status_changed',
      data: { from: 'registration', to: 'contract_signing', source: 'contract' },
      createdBy: user.id,
    });
  }

  refresh(process.id);

  return { success: true };
}

/* =========================================================
   RESULTADO DO FINANCIAMENTO
========================================================= */

export async function setFundingStatusAction(
  processId: string,
  fundingStatus: FundingStatus,
): Promise<ActionResult> {
  const { supabase, user, process } = await loadContext(processId);

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  if (!process) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  if (!FUNDING_STATUSES.includes(fundingStatus)) {
    return { success: false, message: 'Resultado inválido.' };
  }

  if (!process.contract_resolved_at) {
    return {
      success: false,
      message: 'O resultado do financiamento regista-se depois da assinatura do contrato.',
    };
  }

  if (process.funding_status === fundingStatus) {
    return { success: true };
  }

  const { error } = await supabase
    .from('credit_processes')
    .update({
      funding_status: fundingStatus,
      funding_status_at: new Date().toISOString(),
    })
    .eq('id', process.id);

  if (error) {
    console.error('Erro ao atualizar financiamento:', error);

    return {
      success: false,
      message: 'Não foi possível guardar o resultado.',
    };
  }

  await logProcessEvent(supabase, {
    processId: process.id,
    type: 'funding_status_changed',
    data: { from: process.funding_status, to: fundingStatus },
    createdBy: user.id,
  });

  refresh(process.id);

  return { success: true };
}

/* =========================================================
   AVERBAMENTO VERIFICADO

   Averbamento → Concluído. Data vazia anula a verificação.
========================================================= */

export async function setRegistrationVerifiedAction(
  processId: string,
  verifiedOn: string,
): Promise<ActionResult> {
  const { supabase, user, process } = await loadContext(processId);

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  if (!process) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  if (verifiedOn) {
    if (process.status !== 'registration') {
      return {
        success: false,
        message: 'O processo não está na fase de averbamento.',
      };
    }

    if (!ISO_DATE.test(verifiedOn) || verifiedOn > todayIsoDate()) {
      return {
        success: false,
        message: 'Indica uma data de verificação válida (não futura).',
      };
    }

    const { error } = await supabase
      .from('credit_processes')
      .update({
        status: 'completed',
        registration_verified_on: verifiedOn,
      })
      .eq('id', process.id);

    if (error) {
      console.error('Erro ao verificar averbamento:', error);

      return {
        success: false,
        message: 'Não foi possível registar o averbamento.',
      };
    }

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'registration_verified',
      data: { verified_on: verifiedOn },
      createdBy: user.id,
    });

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'process_status_changed',
      data: { from: 'registration', to: 'completed', source: 'registration' },
      createdBy: user.id,
    });
  } else {
    if (process.status !== 'completed' || !process.registration_verified_on) {
      return {
        success: false,
        message: 'Não existe verificação de averbamento para anular.',
      };
    }

    const { error } = await supabase
      .from('credit_processes')
      .update({
        status: 'registration',
        registration_verified_on: null,
      })
      .eq('id', process.id);

    if (error) {
      console.error('Erro ao anular averbamento:', error);

      return {
        success: false,
        message: 'Não foi possível anular a verificação.',
      };
    }

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'registration_reopened',
      createdBy: user.id,
    });

    await logProcessEvent(supabase, {
      processId: process.id,
      type: 'process_status_changed',
      data: { from: 'completed', to: 'registration', source: 'registration' },
      createdBy: user.id,
    });
  }

  refresh(process.id);

  return { success: true };
}
