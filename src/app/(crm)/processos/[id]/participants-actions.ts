'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logProcessEvent } from '@/lib/crm/events';
import {
  ensureRgpdState,
  getRgpdLabel,
} from '@/lib/rgpd/ensure-rgpd-state';

type AddableRole = 'second_holder' | 'guarantor' | 'other';

const ADDABLE_ROLES: AddableRole[] = [
  'second_holder',
  'guarantor',
  'other',
];

export type AddParticipantInput = {
  role: AddableRole;
} & (
  | {
      mode: 'existing';
      clientId: string;
    }
  | {
      mode: 'new';
      client: {
        fullName: string;
        nif: string;
        identificationNumber: string;
        email: string;
        phone: string;
      };
    }
);

type ActionResult =
  | { success: true }
  | { success: false; message: string };

/* =========================================================
   ADICIONAR INTERVENIENTE

   • Cliente existente ou novo cliente (criado aqui)
   • Cria logo o RGPD próprio do interveniente
========================================================= */

export async function addParticipantAction(
  processId: string,
  input: AddParticipantInput,
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  if (!ADDABLE_ROLES.includes(input.role)) {
    return { success: false, message: 'Papel inválido.' };
  }

  /*
   * Validar o processo por RLS.
   */
  const { data: creditProcess } = await supabase
    .from('credit_processes')
    .select('id')
    .eq('id', processId)
    .maybeSingle();

  if (!creditProcess) {
    return { success: false, message: 'Processo não encontrado.' };
  }

  /* =======================================================
     CLIENTE
  ======================================================= */

  let clientId: string;
  let clientName: string;

  if (input.mode === 'existing') {
    const { data: client } = await supabase
      .from('clients')
      .select('id, full_name')
      .eq('id', input.clientId)
      .maybeSingle();

    if (!client) {
      return { success: false, message: 'Cliente não encontrado.' };
    }

    clientId = client.id;
    clientName = client.full_name;
  } else {
    const fullName = input.client.fullName.trim();
    const nif = input.client.nif.replace(/\D/g, '');

    if (!fullName) {
      return { success: false, message: 'Indica o nome do cliente.' };
    }

    if (nif && nif.length !== 9) {
      return { success: false, message: 'O NIF deve ter 9 dígitos.' };
    }

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        manager_id: user.id,
        full_name: fullName,
        nif: nif || null,
        identification_number:
          input.client.identificationNumber.trim() || null,
        email: input.client.email.trim() || null,
        phone: input.client.phone.trim() || null,
      })
      .select('id, full_name')
      .single();

    if (clientError || !newClient) {
      console.error('Erro ao criar cliente:', clientError);

      return {
        success: false,
        message: 'Não foi possível criar o cliente.',
      };
    }

    clientId = newClient.id;
    clientName = newClient.full_name;
  }

  /* =======================================================
     ASSOCIAR AO PROCESSO
  ======================================================= */

  const { error: participantError } = await supabase
    .from('process_participants')
    .insert({
      process_id: creditProcess.id,
      client_id: clientId,
      role: input.role,
      created_by: user.id,
    });

  if (participantError) {
    if (participantError.code === '23505') {
      return {
        success: false,
        message:
          input.role === 'second_holder'
            ? 'Este processo já tem 2.º titular, ou o cliente já é interveniente.'
            : 'Este cliente já é interveniente neste processo.',
      };
    }

    console.error('Erro ao adicionar interveniente:', participantError);

    return {
      success: false,
      message: 'Não foi possível adicionar o interveniente.',
    };
  }

  await logProcessEvent(supabase, {
    processId: creditProcess.id,
    type: 'participant_added',
    data: { client_id: clientId, role: input.role },
    createdBy: user.id,
  });

  /* =======================================================
     RGPD PRÓPRIO DO INTERVENIENTE
  ======================================================= */

  try {
    await ensureRgpdState(
      createAdminClient(),
      creditProcess.id,
      clientId,
      user.id,
      getRgpdLabel(input.role, clientName),
    );
  } catch (error) {
    console.error('Erro ao criar RGPD do interveniente:', error);
  }

  revalidatePath(`/processos/${creditProcess.id}`);

  return { success: true };
}

/* =========================================================
   REMOVER INTERVENIENTE

   O 1.º titular nunca é removido (também bloqueado por RLS).
   O pedido RGPD pendente desse cliente é cancelado.
========================================================= */

export async function removeParticipantAction(
  processId: string,
  participantId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  const { data: participant } = await supabase
    .from('process_participants')
    .select('id, client_id, role')
    .eq('id', participantId)
    .eq('process_id', processId)
    .maybeSingle();

  if (!participant) {
    return { success: false, message: 'Interveniente não encontrado.' };
  }

  if (participant.role === 'primary_holder') {
    return {
      success: false,
      message: 'O 1.º titular não pode ser removido.',
    };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('process_participants')
    .delete()
    .eq('id', participant.id)
    .select('id');

  if (deleteError || !deleted?.length) {
    console.error('Erro ao remover interveniente:', deleteError);

    return {
      success: false,
      message: 'Não foi possível remover o interveniente.',
    };
  }

  /*
   * Admin só depois de o acesso ter sido validado por RLS
   * (o interveniente foi lido e removido com o cliente normal).
   */
  const { error: cancelError } = await createAdminClient()
    .from('document_requests')
    .update({ status: 'cancelled' })
    .eq('process_id', processId)
    .eq('client_id', participant.client_id)
    .eq('type', 'rgpd')
    .eq('status', 'pending');

  if (cancelError) {
    console.error('Erro ao cancelar RGPD pendente:', cancelError);
  }

  await logProcessEvent(supabase, {
    processId,
    type: 'participant_removed',
    data: {
      client_id: participant.client_id,
      role: participant.role,
    },
    createdBy: user.id,
  });

  revalidatePath(`/processos/${processId}`);

  return { success: true };
}
