import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import {
  ACTIVE_PROCESS_STATUSES,
  ANALYSIS_PROCESS_STATUSES,
  getProcessStatusLabel,
} from '@/lib/crm/labels';
import { formatShortMonthDate, todayIsoDate } from '@/lib/format';

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayIsoDate();

  /*
   * Contagens feitas na base de dados (head: true).
   *
   * Evita carregar todas as linhas para o servidor e
   * não é afetado pelo limite de 1000 linhas do PostgREST.
   */
  const countProcesses = () =>
    supabase
      .from('credit_processes')
      .select('id', { count: 'exact', head: true });

  const countDocuments = () =>
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true });

  const [
    clientsResult,
    totalProcessesResult,
    activeProcessesResult,
    newProcessesResult,
    documentationProcessesResult,
    analysisProcessesResult,
    approvedProcessesResult,
    completedProcessesResult,
    rejectedProcessesResult,
    pendingDocumentsResult,
    pendingRgpdResult,
    receivedDocumentsResult,
    overdueContractsResult,
    overdueRegistrationsResult,
    recentProcessesResult,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true }),

    countProcesses(),
    countProcesses().in('status', ACTIVE_PROCESS_STATUSES),
    countProcesses().eq('status', 'new'),
    countProcesses().eq('status', 'documentation'),
    countProcesses().in('status', ANALYSIS_PROCESS_STATUSES),
    countProcesses().eq('status', 'approved'),
    countProcesses().eq('status', 'completed'),
    countProcesses().eq('status', 'rejected'),

    countDocuments().eq('status', 'pending'),
    countDocuments().eq('type', 'rgpd').eq('status', 'pending'),
    countDocuments().in('status', ['received', 'signed']),

    countProcesses()
      .eq('status', 'contract_signing')
      .lt('contract_deadline', today),
    countProcesses()
      .eq('status', 'registration')
      .lt('registration_deadline', today),

    supabase
      .from('credit_processes')
      .select(`
        id,
        reference,
        status,
        created_at,
        clients!client_id (
          id,
          full_name
        )
      `)
      .order('created_at', {
        ascending: false,
      })
      .limit(6),
  ]);

  const countResults = {
    clientsResult,
    totalProcessesResult,
    activeProcessesResult,
    newProcessesResult,
    documentationProcessesResult,
    analysisProcessesResult,
    approvedProcessesResult,
    completedProcessesResult,
    rejectedProcessesResult,
    pendingDocumentsResult,
    pendingRgpdResult,
    receivedDocumentsResult,
    overdueContractsResult,
    overdueRegistrationsResult,
  };

  for (const [name, result] of Object.entries(countResults)) {
    if (result.error) {
      console.error(`Erro dashboard (${name}):`, result.error);
    }
  }

  if (recentProcessesResult.error) {
    console.error(
      'Erro dashboard recentes:',
      recentProcessesResult.error,
    );
  }

  const totalClients = clientsResult.count ?? 0;
  const totalProcessCount = totalProcessesResult.count ?? 0;
  const activeProcesses = activeProcessesResult.count ?? 0;
  const newProcesses = newProcessesResult.count ?? 0;
  const documentationProcesses =
    documentationProcessesResult.count ?? 0;
  const analysisProcesses = analysisProcessesResult.count ?? 0;
  const approvedProcesses = approvedProcessesResult.count ?? 0;
  const completedProcesses = completedProcessesResult.count ?? 0;
  const rejectedProcesses = rejectedProcessesResult.count ?? 0;

  const pendingDocuments = pendingDocumentsResult.count ?? 0;
  const pendingRgpd = pendingRgpdResult.count ?? 0;
  const receivedDocuments = receivedDocumentsResult.count ?? 0;
  const overdueContracts = overdueContractsResult.count ?? 0;
  const overdueRegistrations = overdueRegistrationsResult.count ?? 0;

  const recentProcesses =
    recentProcessesResult.data ?? [];

  const attentionCount =
    pendingDocuments +
    documentationProcesses +
    pendingRgpd +
    overdueContracts +
    overdueRegistrations;

  return (
    <div className="space-y-8">
      {/* ===================================================
          HEADER
      =================================================== */}

      <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#006571]">
            Visão geral
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#172126]">
            Dashboard
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
            Acompanhe processos,
            documentação e atividade
            da CrediAuto num só lugar.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/clientes/novo"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
          >
            + Novo cliente
          </Link>

          <Link
            href="/processos/novo"
            className="inline-flex items-center justify-center rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00545e]"
          >
            + Novo processo
          </Link>
        </div>
      </section>

      {/* ===================================================
          KPIs
      =================================================== */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Processos ativos"
          value={activeProcesses}
          description={`${totalProcessCount} processos no total`}
          icon="folder"
          href="/processos"
        />

        <MetricCard
          label="Em documentação"
          value={documentationProcesses}
          description={
            documentationProcesses === 1
              ? '1 processo aguarda documentos'
              : `${documentationProcesses} processos aguardam documentos`
          }
          icon="document"
          href="/processos"
        />

        <MetricCard
          label="Em análise"
          value={analysisProcesses}
          description="Em tratamento pelas financeiras"
          icon="search"
          href="/processos"
        />

        <MetricCard
          label="Aprovados"
          value={approvedProcesses}
          description={`${completedProcesses} concluídos`}
          icon="check"
          href="/processos"
          positive
        />
      </section>

      {/* ===================================================
          MAIN GRID
      =================================================== */}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* PROCESSOS RECENTES */}

        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-[#172126]">
                Processos recentes
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                Última atividade da carteira
              </p>
            </div>

            <Link
              href="/processos"
              className="text-sm font-semibold text-[#006571] transition hover:text-[#004c55]"
            >
              Ver todos
            </Link>
          </div>

          {recentProcesses.length ===
          0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
                <FolderIcon />
              </div>

              <p className="mt-4 text-sm font-semibold text-gray-700">
                Ainda não existem processos
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Os processos criados
                aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentProcesses.map(
                (process) => {
                  const client =
                    Array.isArray(
                      process.clients,
                    )
                      ? process.clients[0]
                      : process.clients;

                  return (
                    <Link
                      key={process.id}
                      href={`/processos/${process.id}`}
                      className="group flex items-center gap-4 px-6 py-4 transition hover:bg-[#F8FBFB]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5F6] text-[#006571]">
                        <FolderIcon />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {process.reference}
                          </p>

                          <ProcessStatus
                            status={
                              process.status
                            }
                          />
                        </div>

                        <p className="mt-1 truncate text-sm text-gray-500">
                          {client?.full_name ??
                            'Cliente'}
                        </p>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-xs text-gray-400">
                          Criado em
                        </p>

                        <p className="mt-1 text-sm font-medium text-gray-600">
                          {formatShortMonthDate(
                            process.created_at,
                          )}
                        </p>
                      </div>

                      <span className="ml-2 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#006571]">
                        →
                      </span>
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </div>

        {/* CARTEIRA */}

        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div>
            <h2 className="text-base font-semibold text-[#172126]">
              Estado da carteira
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Distribuição dos processos
            </p>
          </div>

          <div className="mt-7 space-y-5">
            <PortfolioRow
              label="Novos"
              value={newProcesses}
              total={totalProcessCount}
            />

            <PortfolioRow
              label="Documentação"
              value={
                documentationProcesses
              }
              total={totalProcessCount}
            />

            <PortfolioRow
              label="Em análise"
              value={analysisProcesses}
              total={totalProcessCount}
            />

            <PortfolioRow
              label="Aprovados"
              value={approvedProcesses}
              total={totalProcessCount}
            />

            <PortfolioRow
              label="Concluídos"
              value={completedProcesses}
              total={totalProcessCount}
            />

            <PortfolioRow
              label="Recusados"
              value={rejectedProcesses}
              total={totalProcessCount}
            />
          </div>
        </div>
      </section>

      {/* ===================================================
          ATENÇÃO + DOCUMENTAÇÃO + CLIENTES
      =================================================== */}

      <section className="grid gap-6 lg:grid-cols-3">
        <DashboardPanel
          title="Requer atenção"
          subtitle="Itens que podem precisar de ação"
        >
          {attentionCount === 0 ? (
            <SuccessState />
          ) : (
            <div className="space-y-3">
              <AttentionRow
                label="Documentos pendentes"
                value={pendingDocuments}
              />

              <AttentionRow
                label="Processos em documentação"
                value={
                  documentationProcesses
                }
              />

              <AttentionRow
                label="RGPD por assinar"
                value={pendingRgpd}
              />

              <AttentionRow
                label="Contratos fora do prazo (15 dias)"
                value={overdueContracts}
                href="/prazos"
                urgent
              />

              <AttentionRow
                label="Averbamentos fora do prazo (45 dias)"
                value={overdueRegistrations}
                href="/prazos"
                urgent
              />
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Documentação"
          subtitle="Estado dos documentos"
        >
          <div className="grid grid-cols-2 gap-4">
            <MiniMetric
              label="Recebidos"
              value={receivedDocuments}
            />

            <MiniMetric
              label="Pendentes"
              value={pendingDocuments}
            />
          </div>

          <Link
            href="/documentos"
            className="mt-5 inline-flex text-sm font-semibold text-[#006571] hover:underline"
          >
            Ver documentação →
          </Link>
        </DashboardPanel>

        <DashboardPanel
          title="Clientes"
          subtitle="Carteira atual"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-[#172126]">
                {totalClients}
              </p>

              <p className="mt-2 text-sm text-gray-500">
                clientes registados
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF5F6] text-[#006571]">
              <UsersIcon />
            </div>
          </div>

          <Link
            href="/clientes"
            className="mt-5 inline-flex text-sm font-semibold text-[#006571] hover:underline"
          >
            Ver clientes →
          </Link>
        </DashboardPanel>
      </section>
    </div>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function MetricCard({
  label,
  value,
  description,
  icon,
  href,
  positive = false,
}: {
  label: string;
  value: number;
  description: string;
  icon:
    | 'folder'
    | 'document'
    | 'search'
    | 'check';
  href: string;
  positive?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-[#1693A0]/30 hover:shadow-[0_8px_24px_rgba(0,101,113,0.07)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={[
            'flex h-10 w-10 items-center justify-center rounded-xl',
            positive
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-[#EAF5F6] text-[#006571]',
          ].join(' ')}
        >
          {icon === 'folder' && (
            <FolderIcon />
          )}

          {icon === 'document' && (
            <DocumentIcon />
          )}

          {icon === 'search' && (
            <SearchIcon />
          )}

          {icon === 'check' && (
            <CheckIcon />
          )}
        </div>

        <span className="text-gray-300 transition group-hover:text-[#006571]">
          ↗
        </span>
      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight text-[#172126]">
        {value}
      </p>

      <p className="mt-1 text-sm font-semibold text-gray-700">
        {label}
      </p>

      <p className="mt-2 text-xs leading-5 text-gray-400">
        {description}
      </p>
    </Link>
  );
}

function PortfolioRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage =
    total > 0
      ? Math.round(
          (value / total) * 100,
        )
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-gray-600">
          {label}
        </p>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {percentage}%
          </span>

          <span className="min-w-6 text-right text-sm font-semibold text-gray-900">
            {value}
          </span>
        </div>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-[#1693A0] transition-all"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h2 className="text-base font-semibold text-[#172126]">
        {title}
      </h2>

      <p className="mt-1 text-sm text-gray-400">
        {subtitle}
      </p>

      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}

function AttentionRow({
  label,
  value,
  href,
  urgent = false,
}: {
  label: string;
  value: number;
  href?: string;
  urgent?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div
          className={[
            'h-2 w-2 rounded-full',
            value > 0
              ? urgent
                ? 'bg-red-500'
                : 'bg-amber-400'
              : 'bg-gray-300',
          ].join(' ')}
        />

        <span className="text-sm text-gray-600">
          {label}
        </span>
      </div>

      <span className="text-sm font-semibold text-gray-900">
        {value}
      </span>
    </>
  );

  const className =
    'flex items-center justify-between rounded-xl bg-[#F8FAFA] px-4 py-3';

  return href ? (
    <Link
      href={href}
      className={`${className} transition hover:bg-[#EAF5F6]`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-[#F8FAFA] p-4">
      <p className="text-2xl font-semibold tracking-tight text-[#172126]">
        {value}
      </p>

      <p className="mt-1 text-xs font-medium text-gray-500">
        {label}
      </p>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="rounded-xl bg-emerald-50/70 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          ✓
        </div>

        <div>
          <p className="text-sm font-semibold text-emerald-900">
            Tudo em ordem
          </p>

          <p className="mt-1 text-xs leading-5 text-emerald-700">
            Não existem itens urgentes
            neste momento.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProcessStatus({
  status,
}: {
  status: string;
}) {
  let classes =
    'bg-gray-100 text-gray-600';

  if (
    status === 'approved' ||
    status === 'completed'
  ) {
    classes =
      'bg-emerald-50 text-emerald-700';
  }

  if (
    status === 'documentation' ||
    status === 'contract_signing' ||
    status === 'registration'
  ) {
    classes =
      'bg-amber-50 text-amber-700';
  }

  if (
    status ===
      'ready_for_analysis' ||
    status ===
      'sent_to_lender' ||
    status ===
      'under_analysis'
  ) {
    classes =
      'bg-[#EAF5F6] text-[#006571]';
  }

  if (
    status === 'rejected' ||
    status === 'cancelled'
  ) {
    classes =
      'bg-red-50 text-red-700';
  }

  return (
    <span
      className={[
        'rounded-full px-2.5 py-1 text-[11px] font-semibold',
        classes,
      ].join(' ')}
    >
      {getProcessStatusLabel(status)}
    </span>
  );
}

/* =========================================================
   ÍCONES
========================================================= */

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M3.75 6.75A1.75 1.75 0 0 1 5.5 5h4l2 2H18.5a1.75 1.75 0 0 1 1.75 1.75v8.75a1.75 1.75 0 0 1-1.75 1.75h-13a1.75 1.75 0 0 1-1.75-1.75V6.75Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M7 3.75h6.5L18 8.25v12H7v-16.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M13.5 3.75v4.5H18M9.5 12h6M9.5 15.5h6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="10.75"
        cy="10.75"
        r="5.75"
      />

      <path
        d="m15.25 15.25 4 4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="12"
        cy="12"
        r="8.25"
      />

      <path
        d="m8.5 12 2.25 2.25L15.75 9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M8.75 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM3.75 19.25v-1.5a5 5 0 0 1 10 0v1.5"
        strokeLinecap="round"
      />

      <path
        d="M15.75 10.5a2.75 2.75 0 1 0 0-5.5M16.5 14a4.25 4.25 0 0 1 3.75 4.25v1"
        strokeLinecap="round"
      />
    </svg>
  );
}