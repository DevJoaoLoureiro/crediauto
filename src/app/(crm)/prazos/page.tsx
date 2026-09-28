import type { Metadata } from 'next';
import Link from 'next/link';

import {
  ContractResolvedCheckbox,
  DeadlineBadge,
  FundingStatusSelect,
  RegistrationVerifyForm,
} from '@/components/prazos/stage-controls';
import { createClient } from '@/lib/supabase/server';
import {
  CONTRACT_DEADLINE_DAYS,
  REGISTRATION_DEADLINE_DAYS,
} from '@/lib/crm/labels';
import { formatDate, todayIsoDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Prazos',
};

type DeadlinesPageProps = {
  searchParams: Promise<{
    resolvidos?: string;
  }>;
};

const PROCESS_SELECT = `
  id,
  reference,
  status,
  contract_received_on,
  contract_deadline,
  contract_resolved_at,
  funding_status,
  registration_deadline,
  registration_verified_on,
  clients!client_id (
    full_name
  ),
  commercial:profiles!commercial_id (
    full_name
  ),
  approved_proposal:lender_proposals!approved_proposal_id (
    banks (
      name
    )
  )
`;

type Row = {
  id: string;
  reference: string | null;
  status: string;
  contract_received_on: string | null;
  contract_deadline: string | null;
  contract_resolved_at: string | null;
  funding_status: string | null;
  registration_deadline: string | null;
  registration_verified_on: string | null;
  clientName: string | null;
  commercialName: string | null;
  bankName: string | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toRow(raw: Record<string, unknown>): Row {
  const proposal = first(
    raw.approved_proposal as
      | { banks: { name: string } | { name: string }[] | null }
      | null,
  );

  return {
    id: raw.id as string,
    reference: raw.reference as string | null,
    status: raw.status as string,
    contract_received_on: raw.contract_received_on as string | null,
    contract_deadline: raw.contract_deadline as string | null,
    contract_resolved_at: raw.contract_resolved_at as string | null,
    funding_status: raw.funding_status as string | null,
    registration_deadline: raw.registration_deadline as string | null,
    registration_verified_on: raw.registration_verified_on as string | null,
    clientName:
      first(raw.clients as { full_name: string } | null)?.full_name ?? null,
    commercialName:
      first(raw.commercial as { full_name: string } | null)?.full_name ??
      null,
    bankName: first(proposal?.banks)?.name ?? null,
  };
}

export default async function DeadlinesPage({
  searchParams,
}: DeadlinesPageProps) {
  const params = await searchParams;
  const showResolved = params.resolvidos === '1';
  const today = todayIsoDate();

  const supabase = await createClient();

  const [contractsResult, registrationsResult] = await Promise.all([
    supabase
      .from('credit_processes')
      .select(PROCESS_SELECT)
      .in(
        'status',
        showResolved
          ? ['contract_signing', 'registration']
          : ['contract_signing'],
      )
      .order('contract_deadline', { ascending: true }),

    supabase
      .from('credit_processes')
      .select(PROCESS_SELECT)
      .in(
        'status',
        showResolved ? ['registration', 'completed'] : ['registration'],
      )
      .not('contract_resolved_at', 'is', null)
      .order('registration_deadline', { ascending: true })
      .limit(showResolved ? 200 : 1000),
  ]);

  if (contractsResult.error) {
    console.error('Erro ao carregar contratos:', contractsResult.error);
  }

  if (registrationsResult.error) {
    console.error(
      'Erro ao carregar averbamentos:',
      registrationsResult.error,
    );
  }

  const contracts = (contractsResult.data ?? []).map(toRow);
  const registrations = (registrationsResult.data ?? []).map(toRow);

  const overdueContracts = contracts.filter(
    (row) =>
      !row.contract_resolved_at &&
      row.contract_deadline !== null &&
      row.contract_deadline < today,
  ).length;

  const overdueRegistrations = registrations.filter(
    (row) =>
      !row.registration_verified_on &&
      row.registration_deadline !== null &&
      row.registration_deadline < today,
  ).length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1693A0]">Acompanhamento</p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
            Prazos
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Contratos a devolver assinados ({CONTRACT_DEADLINE_DAYS} dias) e
            averbamentos a verificar ({REGISTRATION_DEADLINE_DAYS} dias).
          </p>
        </div>

        <Link
          href={showResolved ? '/prazos' : '/prazos?resolvidos=1'}
          className={[
            'rounded-lg px-3 py-2 text-xs font-semibold transition',
            showResolved
              ? 'bg-[#EAF5F6] text-[#006571]'
              : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50',
          ].join(' ')}
        >
          {showResolved ? '✓ ' : ''}Mostrar resolvidos
        </Link>
      </div>

      {/* CONTRATOS */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <SectionHeader
          title="Assinatura do contrato"
          description={`O comercial tem ${CONTRACT_DEADLINE_DAYS} dias, a contar da receção do contrato do banco, para entregar o contrato assinado.`}
          count={contracts.length}
          overdue={overdueContracts}
        />

        {contracts.length === 0 ? (
          <EmptyRow text="Nenhum contrato a aguardar assinatura." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Processo</th>
                  <th className="px-6 py-4">Banco</th>
                  <th className="px-6 py-4">Comercial</th>
                  <th className="px-6 py-4">Recebido</th>
                  <th className="px-6 py-4">Prazo</th>
                  <th className="px-6 py-4">Faltam</th>
                  <th className="px-6 py-4">Resolvido</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {contracts.map((row) => (
                  <tr key={row.id}>
                    <ProcessCell row={row} />

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.bankName ?? '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.commercialName ?? (
                        <span className="text-gray-400">Sem comercial</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(row.contract_received_on)}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(row.contract_deadline)}
                    </td>

                    <td className="px-6 py-4">
                      {row.contract_resolved_at ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <DeadlineBadge
                          deadline={row.contract_deadline}
                          today={today}
                        />
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <ContractResolvedCheckbox
                        processId={row.id}
                        resolved={Boolean(row.contract_resolved_at)}
                        label={row.contract_resolved_at ? 'Sim' : 'Não'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AVERBAMENTOS */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <SectionHeader
          title="Averbamento"
          description={`Após a entrega do contrato assinado, há ${REGISTRATION_DEADLINE_DAYS} dias para verificar o averbamento.`}
          count={registrations.length}
          overdue={overdueRegistrations}
        />

        {registrations.length === 0 ? (
          <EmptyRow text="Nenhum averbamento por verificar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Processo</th>
                  <th className="px-6 py-4">Banco</th>
                  <th className="px-6 py-4">Financiamento</th>
                  <th className="px-6 py-4">Contrato resolvido</th>
                  <th className="px-6 py-4">Prazo</th>
                  <th className="px-6 py-4">Faltam</th>
                  <th className="px-6 py-4">Verificação</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {registrations.map((row) => (
                  <tr key={row.id}>
                    <ProcessCell row={row} />

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.bankName ?? '—'}
                    </td>

                    <td className="px-6 py-4">
                      <FundingStatusSelect
                        processId={row.id}
                        value={row.funding_status}
                      />
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(row.contract_resolved_at)}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(row.registration_deadline)}
                    </td>

                    <td className="px-6 py-4">
                      {row.registration_verified_on ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <DeadlineBadge
                          deadline={row.registration_deadline}
                          today={today}
                        />
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <RegistrationVerifyForm
                        processId={row.id}
                        verifiedOn={row.registration_verified_on}
                        today={today}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  count,
  overdue,
}: {
  title: string;
  description: string;
  count: number;
  overdue: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-semibold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm text-gray-400">{description}</p>
      </div>

      <div className="flex shrink-0 gap-2 text-xs font-semibold">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
          {count} {count === 1 ? 'processo' : 'processos'}
        </span>

        {overdue > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
            {overdue} em atraso
          </span>
        )}
      </div>
    </div>
  );
}

function ProcessCell({ row }: { row: Row }) {
  return (
    <td className="px-6 py-4">
      <Link
        href={`/processos/${row.id}`}
        className="font-semibold text-[#006571] hover:underline"
      >
        {row.reference ?? 'Processo'}
      </Link>

      <p className="mt-1 text-xs text-gray-400">{row.clientName ?? '—'}</p>
    </td>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-6 py-12 text-center text-sm text-gray-400">{text}</p>;
}
