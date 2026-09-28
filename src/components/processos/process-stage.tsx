'use client';

import { useState, useTransition } from 'react';

import { startContractPhaseAction } from '@/app/(crm)/processos/[id]/stage-actions';
import {
  ContractResolvedCheckbox,
  DeadlineBadge,
  FundingStatusSelect,
  RegistrationVerifyForm,
} from '@/components/prazos/stage-controls';
import {
  CONTRACT_DEADLINE_DAYS,
  REGISTRATION_DEADLINE_DAYS,
} from '@/lib/crm/labels';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

export type ProcessStageData = {
  processId: string;
  status: string;
  today: string;

  approvedProposals: {
    id: string;
    bankName: string;
    approvedAmount: number | null;
  }[];

  contractBankName: string | null;
  contractReceivedOn: string | null;
  contractDeadline: string | null;
  contractResolvedAt: string | null;

  fundingStatus: string | null;

  registrationDeadline: string | null;
  registrationVerifiedOn: string | null;
};

const STEPS = [
  { id: 'analysis', label: 'Propostas' },
  { id: 'approved', label: 'Aprovado' },
  { id: 'contract_signing', label: 'Assinatura do contrato' },
  { id: 'registration', label: 'Averbamento' },
  { id: 'completed', label: 'Concluído' },
];

function currentStepIndex(status: string) {
  switch (status) {
    case 'approved':
      return 1;
    case 'contract_signing':
      return 2;
    case 'registration':
      return 3;
    case 'completed':
      return 4;
    default:
      return 0;
  }
}

export default function ProcessStage({ data }: { data: ProcessStageData }) {
  const stepIndex = currentStepIndex(data.status);
  const closed = data.status === 'cancelled' || data.status === 'rejected';

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-gray-950">Fases</h2>

      {/* PERCURSO */}

      <ol className="mt-5 grid grid-cols-5 gap-2">
        {STEPS.map((step, index) => {
          const done = !closed && index < stepIndex;
          const current = !closed && index === stepIndex;

          return (
            <li key={step.id} className="min-w-0">
              <div
                className={[
                  'h-1.5 rounded-full',
                  done
                    ? 'bg-[#006571]'
                    : current
                      ? 'bg-[#1693A0]'
                      : 'bg-gray-100',
                ].join(' ')}
              />
              <p
                className={[
                  'mt-2 truncate text-xs',
                  current
                    ? 'font-semibold text-[#006571]'
                    : done
                      ? 'text-gray-600'
                      : 'text-gray-400',
                ].join(' ')}
                title={step.label}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>

      {/* AÇÃO DA FASE ATUAL */}

      <div className="mt-6">
        {closed ? (
          <p className="text-sm text-gray-500">
            Processo {data.status === 'rejected' ? 'recusado' : 'cancelado'}.
            Para avançar, é preciso uma proposta aprovada.
          </p>
        ) : stepIndex === 0 ? (
          <p className="text-sm text-gray-500">
            À espera de uma proposta aprovada (separador Propostas).
          </p>
        ) : data.status === 'approved' ? (
          <StartContractForm data={data} />
        ) : (
          <PostApprovalPanel data={data} />
        )}
      </div>
    </section>
  );
}

/* =========================================================
   APROVADO → BANCO ENVIOU O CONTRATO
========================================================= */

function StartContractForm({ data }: { data: ProcessStageData }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState(
    data.approvedProposals.length === 1 ? data.approvedProposals[0].id : '',
  );
  const [receivedOn, setReceivedOn] = useState(data.today);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        startTransition(async () => {
          const result = await startContractPhaseAction(data.processId, {
            proposalId,
            receivedOn,
          });

          if (!result.success) {
            setError(result.message);
          }
        });
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600">
        Quando o banco enviar o contrato, regista-o aqui. O comercial tem{' '}
        <strong>{CONTRACT_DEADLINE_DAYS} dias</strong> para devolver o contrato
        assinado.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_170px_auto]">
        <select
          required
          aria-label="Proposta aprovada"
          value={proposalId}
          onChange={(event) => setProposalId(event.target.value)}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#1693A0] focus:bg-white"
        >
          <option value="">Banco que aprovou...</option>
          {data.approvedProposals.map((proposal) => (
            <option key={proposal.id} value={proposal.id}>
              {proposal.bankName}
              {proposal.approvedAmount
                ? ` — ${formatCurrency(proposal.approvedAmount)}`
                : ''}
            </option>
          ))}
        </select>

        <input
          type="date"
          required
          max={data.today}
          value={receivedOn}
          onChange={(event) => setReceivedOn(event.target.value)}
          aria-label="Data de receção do contrato"
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#1693A0] focus:bg-white"
        />

        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d] disabled:opacity-60"
        >
          {isPending ? 'A guardar...' : 'Contrato recebido'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

/* =========================================================
   ASSINATURA DO CONTRATO / AVERBAMENTO / CONCLUÍDO
========================================================= */

function PostApprovalPanel({ data }: { data: ProcessStageData }) {
  const resolved = Boolean(data.contractResolvedAt);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* CONTRATO */}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Contrato {data.contractBankName ? `— ${data.contractBankName}` : ''}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Recebido em {formatDate(data.contractReceivedOn)} · prazo até{' '}
              {formatDate(data.contractDeadline)}
            </p>
          </div>

          {!resolved && (
            <DeadlineBadge deadline={data.contractDeadline} today={data.today} />
          )}
        </div>

        <div className="mt-4">
          <ContractResolvedCheckbox
            processId={data.processId}
            resolved={resolved}
            disabled={data.status === 'completed'}
            label="Contrato assinado entregue (resolvido)"
          />

          {resolved && (
            <p className="mt-1 text-xs text-gray-400">
              Resolvido em {formatDateTime(data.contractResolvedAt)}
            </p>
          )}
        </div>
      </div>

      {/* FINANCIAMENTO E AVERBAMENTO */}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        {resolved ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Financiamento
              </p>
              <div className="mt-2">
                <FundingStatusSelect
                  processId={data.processId}
                  value={data.fundingStatus}
                />
              </div>
            </div>

            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Averbamento · prazo até {formatDate(data.registrationDeadline)}
                </p>

                {!data.registrationVerifiedOn && (
                  <DeadlineBadge
                    deadline={data.registrationDeadline}
                    today={data.today}
                  />
                )}
              </div>

              <div className="mt-2">
                <RegistrationVerifyForm
                  processId={data.processId}
                  verifiedOn={data.registrationVerifiedOn}
                  today={data.today}
                />
              </div>

              {data.registrationVerifiedOn && (
                <p className="mt-1 text-xs text-gray-400">
                  Verificado em {formatDate(data.registrationVerifiedOn)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Depois de o contrato assinado ser entregue, regista-se aqui o
            resultado do financiamento e o averbamento (
            {REGISTRATION_DEADLINE_DAYS} dias).
          </p>
        )}
      </div>
    </div>
  );
}
