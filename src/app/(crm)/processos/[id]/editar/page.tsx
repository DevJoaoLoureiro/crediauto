import Link from 'next/link';
import { notFound } from 'next/navigation';

import ProcessForm from '@/components/processos/process-form';
import { updateProcessAction } from '@/app/(crm)/processos/actions';
import { createClient } from '@/lib/supabase/server';
import { loadProcessFormOptions } from '@/lib/crm/options';

type EditProcessPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditProcessPage({
  params,
  searchParams,
}: EditProcessPageProps) {
  const [{ id }, { error }] = await Promise.all([
    params,
    searchParams,
  ]);

  const supabase = await createClient();

  const [
    { data: process, error: processError },
    { suppliers, team },
  ] = await Promise.all([
    supabase
      .from('credit_processes')
      .select(`
        id,
        reference,
        credit_type,
        requested_amount,
        down_payment,
        term_months,
        supplier_id,
        commercial_id,
        assistant_id,
        administrative_id,
        vehicle_imported,
        vehicle_make,
        vehicle_model,
        vehicle_version,
        vehicle_year,
        vehicle_registration,
        vehicle_price,
        notes
      `)
      .eq('id', id)
      .maybeSingle(),

    loadProcessFormOptions(supabase),
  ]);

  if (processError || !process) {
    if (processError) {
      console.error('Erro ao carregar processo:', processError);
    }

    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href={`/processos/${process.id}`}
          className="text-sm font-medium text-[#006571] hover:underline"
        >
          ← Voltar ao processo
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950">
          Editar processo
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          {process.reference ?? 'Processo'}
        </p>
      </div>

      <ProcessForm
        action={updateProcessAction.bind(null, process.id)}
        mode="edit"
        cancelHref={`/processos/${process.id}`}
        suppliers={suppliers}
        team={team}
        defaultValues={process}
        error={error}
      />
    </div>
  );
}
