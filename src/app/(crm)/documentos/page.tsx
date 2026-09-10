import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

const documentTypeLabels: Record<string, string> = {
  identity: 'Documento de identificação',
  address_proof: 'Comprovativo de morada',
  income_proof: 'Comprovativo de rendimentos',
  bank_statement: 'Extrato bancário',
  irs: 'IRS',
  tax_assessment: 'Nota de liquidação',
  rgpd: 'RGPD',
  vehicle_document: 'Documento da viatura',
  other: 'Outro',
};

const documentStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  received: 'Recebido',
  signed: 'Assinado',
  rejected: 'Rejeitado',
};

export default async function DocumentsPage() {
  const supabase = await createClient();

  const { data: documents, error } = await supabase
    .from('documents')
    .select(`
      id,
      type,
      status,
      file_name,
      signed_at,
      created_at,
      updated_at,

      clients (
        id,
        full_name
      ),

      credit_processes (
        id,
        reference
      )
    `)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error('Erro documentos:', error);
  }

  const rows = documents ?? [];

  const pending = rows.filter(
    (document) => document.status === 'pending',
  ).length;

  const received = rows.filter(
    (document) => document.status === 'received',
  ).length;

  const signed = rows.filter(
    (document) => document.status === 'signed',
  ).length;

  const rejected = rows.filter(
    (document) => document.status === 'rejected',
  ).length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#006571]">
            Documentação
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#172126]">
            Documentos
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
            Acompanhe toda a documentação dos clientes e processos.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pendentes"
          value={pending}
          tone="warning"
        />

        <MetricCard
          label="Recebidos"
          value={received}
          tone="info"
        />

        <MetricCard
          label="Assinados"
          value={signed}
          tone="success"
        />

        <MetricCard
          label="Rejeitados"
          value={rejected}
          tone="danger"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#172126]">
              Documentação
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              {rows.length} {rows.length === 1 ? 'documento' : 'documentos'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip label="Todos" active />
            <FilterChip label="Pendentes" />
            <FilterChip label="Recebidos" />
            <FilterChip label="Assinados" />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAFBFB] text-left">
                  <TableHead>Documento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead />
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {rows.map((document) => {
                  const client = Array.isArray(document.clients)
                    ? document.clients[0]
                    : document.clients;

                  const process = Array.isArray(document.credit_processes)
                    ? document.credit_processes[0]
                    : document.credit_processes;

                  return (
                    <tr
                      key={document.id}
                      className="transition hover:bg-[#F8FBFB]"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5F6] text-[#006571]">
                            <DocumentIcon />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {documentTypeLabels[document.type] ?? document.type}
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-400">
                              {document.file_name ?? 'Sem ficheiro'}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {client ? (
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-sm font-medium text-gray-700 hover:text-[#006571]"
                          >
                            {client.full_name}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {process ? (
                          <Link
                            href={`/processos/${process.id}`}
                            className="text-sm font-semibold text-[#006571] hover:underline"
                          >
                            {process.reference}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={document.status} />
                      </TableCell>

                      <TableCell>
                        <span className="text-sm text-gray-500">
                          {formatDate(
                            document.updated_at ?? document.created_at,
                          )}
                        </span>
                      </TableCell>

                      <TableCell>
                        {process && (
                          <Link
                            href={`/processos/${process.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                          >
                            Abrir
                          </Link>
                        )}
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'info' | 'success' | 'danger';
}) {
  const styles = {
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-[#EAF5F6] text-[#006571]',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-red-50 text-red-700',
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div
        className={[
          'flex h-9 w-9 items-center justify-center rounded-xl',
          styles[tone],
        ].join(' ')}
      >
        <DocumentIcon />
      </div>

      <p className="mt-4 text-3xl font-semibold tracking-tight text-[#172126]">
        {value}
      </p>

      <p className="mt-1 text-sm font-medium text-gray-600">{label}</p>
    </div>
  );
}

function FilterChip({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        'rounded-lg px-3 py-2 text-xs font-semibold transition',
        active
          ? 'bg-[#EAF5F6] text-[#006571]'
          : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function TableHead({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <th className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <td className="px-6 py-4">{children}</td>;
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  let classes = 'bg-gray-100 text-gray-600';

  if (status === 'pending') {
    classes = 'bg-amber-50 text-amber-700';
  }

  if (status === 'received') {
    classes = 'bg-[#EAF5F6] text-[#006571]';
  }

  if (status === 'signed') {
    classes = 'bg-emerald-50 text-emerald-700';
  }

  if (status === 'rejected') {
    classes = 'bg-red-50 text-red-700';
  }

  return (
    <span
      className={[
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        classes,
      ].join(' ')}
    >
      {documentStatusLabels[status] ?? status}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
        <DocumentIcon />
      </div>

      <p className="mt-4 text-sm font-semibold text-gray-700">
        Ainda não existem documentos
      </p>

      <p className="mt-1 text-sm text-gray-400">
        A documentação dos processos irá aparecer aqui.
      </p>
    </div>
  );
}

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M6 3.5h8l4 4V20H6V3.5Z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 12h6M9 15.5h6" />
    </svg>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}