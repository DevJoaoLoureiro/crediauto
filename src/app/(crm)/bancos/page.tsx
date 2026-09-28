import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';

import { createBankAction, setBankActiveAction } from './actions';

export const metadata: Metadata = {
  title: 'Bancos',
};

type BanksPageProps = {
  searchParams: Promise<{
    error?: string;
    created?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  'missing-name': 'Indica o nome do banco.',
  duplicate: 'Já existe um banco com esse nome.',
  create: 'Não foi possível criar o banco.',
};

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10';

export default async function BanksPage({ searchParams }: BanksPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const [banksResult, proposalsResult] = await Promise.all([
    supabase
      .from('banks')
      .select('id, name, notes, active')
      .order('active', { ascending: false })
      .order('name', { ascending: true }),

    /*
     * Só as colunas necessárias para contar por banco e estado.
     */
    supabase
      .from('lender_proposals')
      .select('bank_id, status'),
  ]);

  if (banksResult.error) {
    console.error('Erro ao carregar bancos:', banksResult.error);
  }

  if (proposalsResult.error) {
    console.error('Erro ao carregar propostas:', proposalsResult.error);
  }

  const counts = new Map<
    string,
    { in_analysis: number; approved: number; rejected: number }
  >();

  for (const proposal of proposalsResult.data ?? []) {
    const current = counts.get(proposal.bank_id) ?? {
      in_analysis: 0,
      approved: 0,
      rejected: 0,
    };

    if (proposal.status in current) {
      current[proposal.status as keyof typeof current] += 1;
    }

    counts.set(proposal.bank_id, current);
  }

  const banks = banksResult.data ?? [];
  const errorMessage = params.error
    ? errorMessages[params.error] ?? null
    : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div>
        <p className="text-sm font-medium text-[#1693A0]">Gestão</p>

        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
          Bancos
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Bancos e financeiras para onde os processos são enviados.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-950">Novo banco</h2>

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
            Banco criado.
          </div>
        )}

        <form
          action={createBankAction}
          className="mt-5 grid gap-4 md:grid-cols-[1fr_2fr_auto]"
        >
          <input
            name="name"
            required
            placeholder="Nome *"
            aria-label="Nome"
            className={inputClassName}
          />

          <input
            name="notes"
            placeholder="Notas (contacto, condições...)"
            aria-label="Notas"
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

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="font-semibold text-gray-950">Todos os bancos</h2>

          <p className="mt-1 text-sm text-gray-400">
            Propostas aprovadas, recusadas e em análise por banco.
          </p>
        </div>

        {banks.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">
            Ainda não existem bancos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Banco</th>
                  <th className="px-6 py-4 text-right">Em análise</th>
                  <th className="px-6 py-4 text-right">Aprovadas</th>
                  <th className="px-6 py-4 text-right">Recusadas</th>
                  <th className="px-6 py-4 text-right">Taxa de aprovação</th>
                  <th className="px-6 py-4 text-right">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {banks.map((bank) => {
                  const bankCounts = counts.get(bank.id) ?? {
                    in_analysis: 0,
                    approved: 0,
                    rejected: 0,
                  };

                  const decided =
                    bankCounts.approved + bankCounts.rejected;

                  return (
                    <tr
                      key={bank.id}
                      className={bank.active ? '' : 'bg-gray-50/60'}
                    >
                      <td className="px-6 py-4">
                        <p
                          className={
                            bank.active
                              ? 'font-medium text-gray-900'
                              : 'font-medium text-gray-400'
                          }
                        >
                          {bank.name}
                        </p>

                        {bank.notes && (
                          <p className="mt-1 text-xs text-gray-400">
                            {bank.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-600">
                        {bankCounts.in_analysis}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-medium tabular-nums text-emerald-700">
                        {bankCounts.approved}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-medium tabular-nums text-red-700">
                        {bankCounts.rejected}
                      </td>

                      <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-600">
                        {decided > 0
                          ? `${Math.round((bankCounts.approved / decided) * 100)}%`
                          : '—'}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <form
                          action={setBankActiveAction.bind(
                            null,
                            bank.id,
                            !bank.active,
                          )}
                        >
                          <button
                            type="submit"
                            className={[
                              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                              bank.active
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                            ].join(' ')}
                            title={
                              bank.active
                                ? 'Desativar (deixa de aparecer nas novas propostas)'
                                : 'Reativar'
                            }
                          >
                            {bank.active ? 'Ativo' : 'Inativo'}
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
