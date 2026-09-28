import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * =========================================================
 * HISTÓRICO DE EVENTOS DO PROCESSO
 *
 * Registo usado pelo separador Histórico e pelas estatísticas.
 * Um erro aqui nunca deve bloquear a ação principal.
 * =========================================================
 */

export type ProcessEventType =
  | 'process_created'
  | 'process_updated'
  | 'participant_added'
  | 'participant_removed'
  | 'rgpd_requested'
  | 'rgpd_signed'
  | 'process_status_changed'
  | 'proposal_submitted'
  | 'proposal_decided'
  | 'proposal_documents_requested'
  | 'counter_proposal'
  | 'contract_received'
  | 'contract_resolved'
  | 'contract_reopened'
  | 'funding_status_changed'
  | 'registration_verified'
  | 'registration_reopened'
  | 'task_completed';

export async function logProcessEvent(
  supabase: SupabaseClient,
  event: {
    processId: string;
    type: ProcessEventType;
    data?: Record<string, unknown>;
    createdBy?: string | null;
  },
) {
  const { error } = await supabase
    .from('process_events')
    .insert({
      process_id: event.processId,
      type: event.type,
      data: event.data ?? {},
      created_by: event.createdBy ?? null,
    });

  if (error) {
    console.error(
      `Erro ao registar evento ${event.type}:`,
      error,
    );
  }
}
