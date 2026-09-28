import Link from 'next/link';

import ProcessForm from '@/components/processos/process-form';
import { createProcessAction } from '@/app/(crm)/processos/actions';
import { createClient } from '@/lib/supabase/server';
import { loadProcessFormOptions } from '@/lib/crm/options';

type NewProcessPageProps = {
  searchParams: Promise<{
    client?: string;
    error?: string;
  }>;
};

export default async function NewProcessPage({
  searchParams,
}: NewProcessPageProps) {
  const params = await searchParams;

  const supabase = await createClient();

  const [
    { data: clients, error },
    { suppliers, team },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, nif')
      .order('full_name', {
        ascending: true,
      }),

    loadProcessFormOptions(supabase),
  ]);

  if (error) {
    console.error('Erro ao carregar clientes:', error);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href="/processos"
          className="text-sm font-medium text-[#006571] hover:underline"
        >
          ← Voltar aos processos
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950">
          Novo processo
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Regista um novo processo de financiamento.
        </p>
      </div>

      <ProcessForm
        action={createProcessAction}
        mode="create"
        cancelHref="/processos"
        suppliers={suppliers}
        team={team}
        clients={clients ?? []}
        selectedClientId={params.client}
        error={params.error}
      />
    </div>
  );
}