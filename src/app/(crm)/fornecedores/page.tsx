import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';

import {
  createSupplierAction,
  setSupplierActiveAction,
} from './actions';

export const metadata: Metadata = {
  title: 'Fornecedores',
};

type SuppliersPageProps = {
  searchParams: Promise<{
    error?: string;
    created?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  'missing-name': 'Indica o nome do fornecedor.',
  'invalid-nif': 'O NIF deve ter 9 dígitos.',
  create: 'Não foi possível criar o fornecedor.',
};

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10';

export default async function SuppliersPage({
  searchParams,
}: SuppliersPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select(`
      id,
      name,
      nif,
      email,
      phone,
      city,
      active,
      credit_processes (
        count
      )
    `)
    .order('active', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao carregar fornecedores:', error);
  }

  const rows = suppliers ?? [];
  const errorMessage = params.error
    ? errorMessages[params.error] ?? null
    : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div>
        <p className="text-sm font-medium text-[#1693A0]">Gestão</p>

        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
          Fornecedores
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Stands e fornecedores do bem financiado.
        </p>
      </div>

      {/* NOVO FORNECEDOR */}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-950">Novo fornecedor</h2>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {params.created && !errorMessage && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            Fornecedor criado.
          </div>
        )}

        <form
          action={createSupplierAction}
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1.5fr_1fr_1fr_auto]"
        >
          <input
            name="name"
            required
            placeholder="Nome *"
            aria-label="Nome"
            className={inputClassName}
          />

          <input
            name="nif"
            inputMode="numeric"
            maxLength={9}
            placeholder="NIF"
            aria-label="NIF"
            className={inputClassName}
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            className={inputClassName}
          />

          <input
            name="phone"
            type="tel"
            placeholder="Telefone"
            aria-label="Telefone"
            className={inputClassName}
          />

          <input
            name="city"
            placeholder="Localidade"
            aria-label="Localidade"
            className={inputClassName}
          />

          <button
            type="submit"
            className="rounded-xl bg-[#006571] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
          >
            Adicionar
          </button>
        </form>
      </section>

      {/* LISTA */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="font-semibold text-gray-950">
            Todos os fornecedores
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            {rows.length}{' '}
            {rows.length === 1 ? 'fornecedor' : 'fornecedores'}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">
            Ainda não existem fornecedores.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">NIF</th>
                  <th className="px-6 py-4">Contactos</th>
                  <th className="px-6 py-4">Localidade</th>
                  <th className="px-6 py-4">Processos</th>
                  <th className="px-6 py-4 text-right">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {rows.map((supplier) => {
                  const processCount =
                    (supplier.credit_processes as { count: number }[])?.[0]
                      ?.count ?? 0;

                  return (
                    <tr
                      key={supplier.id}
                      className={
                        supplier.active ? '' : 'bg-gray-50/60 text-gray-400'
                      }
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {supplier.name}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {supplier.nif ?? '—'}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {[supplier.email, supplier.phone]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {supplier.city ?? '—'}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {processCount}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <form
                          action={setSupplierActiveAction.bind(
                            null,
                            supplier.id,
                            !supplier.active,
                          )}
                        >
                          <button
                            type="submit"
                            className={[
                              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                              supplier.active
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                            ].join(' ')}
                            title={
                              supplier.active
                                ? 'Desativar (deixa de aparecer nos novos processos)'
                                : 'Reativar'
                            }
                          >
                            {supplier.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </form>
                      </td>
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
