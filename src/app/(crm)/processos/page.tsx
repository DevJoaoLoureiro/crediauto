import Link from 'next/link';

import ProcessesTable, {
  type ProcessListItem,
} from '@/components/processos/processes-table';

import { createClient } from '@/lib/supabase/server';

export default async function ProcessesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('credit_processes')
    .select(`
      id,
      reference,
      status,
      credit_type,
      requested_amount,
      vehicle_make,
      vehicle_model,
      vehicle_imported,
      created_at,
      clients!client_id (
        id,
        full_name,
        nif
      )
    `)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error('Erro ao carregar processos:', error);
  }

  const processes = (data ?? []) as ProcessListItem[];

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-[#1693A0]">
            Gestão
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
            Processos
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Acompanha os processos de financiamento.
          </p>
        </div>

        <Link
          href="/processos/novo"
          className="inline-flex items-center justify-center rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
        >
          + Novo processo
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="font-semibold text-gray-950">
            Todos os processos
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            {processes.length}{' '}
            {processes.length === 1
              ? 'processo registado'
              : 'processos registados'}
          </p>
        </div>

        <ProcessesTable processes={processes} />
      </section>
    </div>
  );
}