import Link from 'next/link';

export type ProcessListItem = {
  id: string;
  reference: string | null;
  status: string;
  requested_amount: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;

  clients:
    | {
        id: string;
        full_name: string;
        nif: string | null;
      }
    | {
        id: string;
        full_name: string;
        nif: string | null;
      }[]
    | null;
};

type ProcessesTableProps = {
  processes: ProcessListItem[];
};

const statusLabels: Record<string, string> = {
  new: 'Novo',
  documentation: 'Documentação',
  ready_for_analysis: 'Pronto para análise',
  sent_to_lender: 'Enviado',
  under_analysis: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};

export default function ProcessesTable({
  processes,
}: ProcessesTableProps) {
  if (processes.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#006571]/10 text-xl text-[#006571]">
          ▤
        </div>

        <p className="font-medium text-gray-700">
          Ainda não existem processos
        </p>

        <p className="mt-1 max-w-md text-sm text-gray-400">
          Cria o primeiro processo de financiamento.
        </p>

        <Link
          href="/processos/novo"
          className="mt-5 rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00535d]"
        >
          Criar primeiro processo
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px]">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-6 py-4">Referência</th>
            <th className="px-6 py-4">Cliente</th>
            <th className="px-6 py-4">Viatura</th>
            <th className="px-6 py-4">Montante</th>
            <th className="px-6 py-4">Estado</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {processes.map((process) => {
            const client = Array.isArray(process.clients)
              ? process.clients[0]
              : process.clients;

            const vehicle = [
              process.vehicle_make,
              process.vehicle_model,
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <tr
                key={process.id}
                className="transition hover:bg-gray-50/80"
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/processos/${process.id}`}
                    className="font-semibold text-[#006571] hover:underline"
                  >
                    {process.reference || 'Sem referência'}
                  </Link>
                </td>

                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">
                    {client?.full_name || '—'}
                  </p>

                  {client?.nif && (
                    <p className="mt-1 text-xs text-gray-400">
                      NIF {client.nif}
                    </p>
                  )}
                </td>

                <td className="px-6 py-4 text-sm text-gray-600">
                  {vehicle || '—'}
                </td>

                <td className="px-6 py-4 text-sm font-medium text-gray-700">
                  {formatCurrency(process.requested_amount)}
                </td>

                <td className="px-6 py-4">
                  <StatusBadge status={process.status} />
                </td>

                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/processos/${process.id}`}
                    className="text-sm font-medium text-[#006571] hover:underline"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#006571]/10 px-2.5 py-1 text-xs font-semibold text-[#006571]">
      {statusLabels[status] ?? status}
    </span>
  );
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return '—';
  }

  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}