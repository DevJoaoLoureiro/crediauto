import Link from 'next/link';

type Client = {
  id: string;
  full_name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
};

type ClientsTableProps = {
  clients: Client[];
};

export default function ClientsTable({
  clients,
}: ClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#006571]/10 text-xl text-[#006571]">
          ◉
        </div>

        <p className="font-medium text-gray-700">
          Ainda não existem clientes
        </p>

        <p className="mt-1 max-w-md text-sm text-gray-400">
          Cria o primeiro cliente para começares a gerir processos de crédito.
        </p>

        <Link
          href="/clientes/novo"
          className="mt-5 rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00535d]"
        >
          Criar primeiro cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px]">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-6 py-4">Cliente</th>
            <th className="px-6 py-4">NIF</th>
            <th className="px-6 py-4">Contacto</th>
            <th className="px-6 py-4">Localidade</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {clients.map((client) => (
            <tr
              key={client.id}
              className="transition hover:bg-gray-50/80"
            >
              <td className="px-6 py-4">
                <Link
                  href={`/clientes/${client.id}`}
                  className="font-medium text-gray-900 hover:text-[#006571]"
                >
                  {client.full_name}
                </Link>

                {client.email && (
                  <p className="mt-1 text-xs text-gray-400">
                    {client.email}
                  </p>
                )}
              </td>

              <td className="px-6 py-4 text-sm text-gray-600">
                {client.nif || '—'}
              </td>

              <td className="px-6 py-4 text-sm text-gray-600">
                {client.phone || '—'}
              </td>

              <td className="px-6 py-4 text-sm text-gray-600">
                {client.city || '—'}
              </td>

              <td className="px-6 py-4 text-right">
                <Link
                  href={`/clientes/${client.id}`}
                  className="text-sm font-medium text-[#006571] hover:underline"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}