import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id,
      full_name,
      nif,
      email,
      phone,
      city,
      created_at
    `)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error(error);
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-[#1693A0]">
            Gestão
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
            Clientes
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Gestão da carteira de clientes.
          </p>
        </div>

        <Link
          href="/clientes/novo"
          className="inline-flex items-center justify-center rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
        >
          + Novo cliente
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="font-semibold text-gray-950">
            Todos os clientes
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            {clients?.length ?? 0}{' '}
            {(clients?.length ?? 0) === 1
              ? 'cliente registado'
              : 'clientes registados'}
          </p>
        </div>

        {!clients || clients.length === 0 ? (
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">
                    Cliente
                  </th>

                  <th className="px-6 py-4">
                    NIF
                  </th>

                  <th className="px-6 py-4">
                    Contacto
                  </th>

                  <th className="px-6 py-4">
                    Localidade
                  </th>

                  <th className="px-6 py-4 text-right">
                    Ações
                  </th>
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
        )}
      </section>
    </div>
  );
}