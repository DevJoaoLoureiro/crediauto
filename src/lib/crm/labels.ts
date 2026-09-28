/*
 * =========================================================
 * LABELS PARTILHADAS DO CRM
 *
 * Fonte única para estados e tipos de documento.
 * =========================================================
 */

export const PROCESS_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  documentation: 'Documentação',
  ready_for_analysis: 'Pronto para análise',
  sent_to_lender: 'Enviado para financeira',
  under_analysis: 'Em análise',
  approved: 'Aprovado',
  contract_signing: 'Assinatura do contrato',
  registration: 'Averbamento',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};

export const ACTIVE_PROCESS_STATUSES = [
  'new',
  'documentation',
  'ready_for_analysis',
  'sent_to_lender',
  'under_analysis',
  'approved',
  'contract_signing',
  'registration',
];

export const ANALYSIS_PROCESS_STATUSES = [
  'ready_for_analysis',
  'sent_to_lender',
  'under_analysis',
];

export const CREDIT_TYPES = ['auto', 'personal', 'housing'] as const;

export type CreditType = (typeof CREDIT_TYPES)[number];

export const CREDIT_TYPE_LABELS: Record<string, string> = {
  auto: 'Crédito auto',
  personal: 'Crédito pessoal',
  housing: 'Crédito habitação',
};

export const PARTICIPANT_ROLES = [
  'primary_holder',
  'second_holder',
  'guarantor',
  'other',
] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  primary_holder: '1.º titular',
  second_holder: '2.º titular',
  guarantor: 'Avalista',
  other: 'Outro interveniente',
};

export function getCreditTypeLabel(type: string | null | undefined) {
  return type ? CREDIT_TYPE_LABELS[type] ?? type : '—';
}

/* Prazos da Fase 3 (dias de calendário). */
export const CONTRACT_DEADLINE_DAYS = 15;
export const REGISTRATION_DEADLINE_DAYS = 45;

export const FUNDING_STATUSES = [
  'financed',
  'pending',
  'financed_commitment_letter',
] as const;

export type FundingStatus = (typeof FUNDING_STATUSES)[number];

export const FUNDING_STATUS_LABELS: Record<string, string> = {
  financed: 'Financiada',
  pending: 'Pendente',
  financed_commitment_letter: 'Financiada com carta de compromisso',
};

export const PROPOSAL_STATUSES = [
  'in_analysis',
  'approved',
  'rejected',
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  in_analysis: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  identity: 'Documento de identificação',
  address_proof: 'Comprovativo de morada',
  income_proof: 'Comprovativo de rendimentos',
  salary_receipt: 'Recibos de vencimento',
  bank_statement: 'Extrato bancário',
  irs: 'IRS',
  tax_assessment: 'Nota de liquidação',
  iban_proof: 'Comprovativo de IBAN',
  pension_proof: 'Comprovativo de pensão',
  rgpd: 'RGPD',
  vehicle_document: 'Documento da viatura',
  vehicle_invoice: 'Fatura / nota de encomenda',
  other: 'Outro documento',
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  received: 'Recebido',
  signed: 'Assinado',
  rejected: 'Rejeitado',
};

export function getProcessStatusLabel(status: string) {
  return PROCESS_STATUS_LABELS[status] ?? status;
}

export function getDocumentStatusLabel(status: string) {
  return DOCUMENT_STATUS_LABELS[status] ?? status;
}

export function getDocumentTypeLabel(
  type: string,
  fallback?: string | null,
) {
  return (
    DOCUMENT_TYPE_LABELS[type] ??
    fallback ??
    'Documento'
  );
}

/*
 * Descrição legível de um evento do histórico do processo.
 */
export function describeProcessEvent(
  type: string,
  data: Record<string, unknown> | null,
) {
  const value = (key: string) => {
    const raw = data?.[key];
    return typeof raw === 'string' ? raw : null;
  };

  switch (type) {
    case 'process_created':
      return 'Processo criado';
    case 'process_updated':
      return 'Dados do processo atualizados';
    case 'participant_added':
      return `Interveniente adicionado (${PARTICIPANT_ROLE_LABELS[value('role') ?? ''] ?? 'interveniente'})`;
    case 'participant_removed':
      return `Interveniente removido (${PARTICIPANT_ROLE_LABELS[value('role') ?? ''] ?? 'interveniente'})`;
    case 'rgpd_requested':
      return 'RGPD pedido';
    case 'rgpd_signed':
      return 'RGPD assinado';
    case 'process_status_changed':
      return `Estado: ${getProcessStatusLabel(value('from') ?? '')} → ${getProcessStatusLabel(value('to') ?? '')}`;
    case 'proposal_submitted':
      return `Proposta enviada a ${value('bank_name') ?? 'banco'}`;
    case 'proposal_decided': {
      const reason = value('reason');
      return `${value('bank_name') ?? 'Banco'}: proposta ${(PROPOSAL_STATUS_LABELS[value('to') ?? ''] ?? '').toLowerCase()}${reason ? ` — ${reason}` : ''}`;
    }
    case 'proposal_documents_requested':
      return `${value('bank_name') ?? 'Banco'} pediu documentos adicionais`;
    case 'counter_proposal':
      return data?.new_vehicle
        ? 'Contraproposta com nova viatura'
        : 'Contraproposta registada';
    case 'contract_received':
      return `Contrato recebido de ${value('bank_name') ?? 'banco'} — prazo até ${value('deadline') ?? '—'}`;
    case 'contract_resolved':
      return 'Contrato assinado entregue (resolvido)';
    case 'contract_reopened':
      return 'Contrato reaberto (não resolvido)';
    case 'funding_status_changed':
      return `Financiamento: ${FUNDING_STATUS_LABELS[value('to') ?? ''] ?? '—'}`;
    case 'registration_verified':
      return `Averbamento verificado em ${value('verified_on') ?? '—'}`;
    case 'registration_reopened':
      return 'Verificação do averbamento anulada';
    case 'task_completed':
      return `Tarefa concluída: ${value('title') ?? ''}`;
    default:
      return type;
  }
}
