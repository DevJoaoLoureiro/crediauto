import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClientPage({
  params,
}: ClientPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: client } = await supabase
    .from('clients')
    .select(`
      id,
      full_name,
      nif,
      identification_number,
      birth_date,
      email,
      phone,
      address,
      postal_code,
      city,
      notes,
      created_at
    `)
    .eq('id', id)
    .single();

  if (!client) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <Link
          href="/clientes"
          className="text-sm font-medium text-[#006571] hover:underline"
        >
          ← Clientes
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-[#1693A0]">
              Cliente
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
              {client.full_name}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {client.nif
                ? `NIF ${client.nif}`
                : 'NIF não registado'}
            </p>
          </div>

          <Link
            href={`/processos/novo?client=${client.id}`}
            className="rounded-xl bg-[#006571] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
          >
            + Novo processo
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-950">
              Dados do cliente
            </h2>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Info
                label="Nome completo"
                value={client.full_name}
              />

              <Info
                label="NIF"
                value={client.nif}
              />

              <Info
                label="Identificação"
                value={client.identification_number}
              />

              <Info
                label="Data de nascimento"
                value={client.birth_date}
              />

              <Info
                label="Email"
                value={client.email}
              />

              <Info
                label="Telefone"
                value={client.phone}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-950">
              Morada
            </h2>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Info
                  label="Morada"
                  value={client.address}
                />
              </div>

              <Info
                label="Código postal"
                value={client.postal_code}
              />

              <Info
                label="Localidade"
                value={client.city}
              />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-950">
              Processos
            </h2>

            <div className="mt-5 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
              <p className="text-sm text-gray-400">
                Ainda não existem processos associados.
              </p>
            </div>
          </section>

          {client.notes && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-950">
                Notas
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {client.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

type InfoProps = {
  label: string;
  value?: string | null;
};

function Info({
  label,
  value,
}: InfoProps) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-medium text-gray-800">
        {value || '—'}
      </p>
    </div>
  );
}