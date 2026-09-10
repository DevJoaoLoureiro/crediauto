import Link from 'next/link';

import ClientForm from '@/components/clientes/client-form';

type NewClientPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewClientPage({
  searchParams,
}: NewClientPageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href="/clientes"
          className="text-sm font-medium text-[#006571] hover:underline"
        >
          ← Voltar aos clientes
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950">
          Novo cliente
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Regista os dados do cliente no CrediAuto.
        </p>
      </div>

      <ClientForm error={params.error} />
    </div>
  );
}