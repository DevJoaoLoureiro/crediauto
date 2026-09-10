import Link from 'next/link';
import { notFound } from 'next/navigation';

import ProcessTabsContent from '@/components/processos/process-tabs-content';
import GenerateClientPortalLink from '@/components/processos/generate-client-portal-link';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type ProcessPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProcessPage({
  params,
}: ProcessPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  /* =========================================================
     PROCESSO
  ========================================================= */

  const {
    data: process,
    error,
  } = await supabase
    .from('credit_processes')
    .select(`
      id,
      reference,
      status,
      requested_amount,
      down_payment,
      term_months,

      vehicle_make,
      vehicle_model,
      vehicle_version,
      vehicle_year,
      vehicle_registration,
      vehicle_price,

      notes,

      client_id,

      created_at,
      updated_at,

      clients (
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
        notes
      ),

      documents (
        id,
        request_id,
        type,
        status,
        file_name,
        storage_path,
        mime_type,
        file_size,
        signed_at,
        created_at,
        updated_at
      )
    `)
    .eq('id', id)
    .single();

  if (error || !process) {
    if (error) {
      console.error(
        'Erro ao carregar processo:',
        error,
      );
    }

    notFound();
  }

  /* =========================================================
     CLIENTE
  ========================================================= */

  const client = Array.isArray(
    process.clients,
  )
    ? process.clients[0]
    : process.clients;

  /* =========================================================
     DOCUMENTOS REAIS
  ========================================================= */

  const documents = Array.isArray(
    process.documents,
  )
    ? process.documents
    : process.documents
      ? [process.documents]
      : [];

  /* =========================================================
     PEDIDOS DE DOCUMENTOS

     Estes são os pedidos criados pelo botão
     "Pedir documentos".
  ========================================================= */

  const {
    data: documentRequestsRaw,
    error: documentRequestsError,
  } = await supabase
    .from('document_requests')
    .select(`
      id,
      process_id,
      client_id,
      type,
      label,
      instructions,
      quantity_required,
      status,
      created_at,
      updated_at
    `)
    .eq('process_id', process.id)
    .neq('status', 'cancelled')
    .order('created_at', {
      ascending: true,
    });

  if (documentRequestsError) {
    console.error(
      'Erro ao carregar pedidos de documentos:',
      documentRequestsError,
    );
  }

  const documentRequests =
    documentRequestsRaw ?? [];

  /* =========================================================
     ADMIN APENAS PARA STORAGE

     O processo já foi autorizado através de RLS.
  ========================================================= */

  const admin = createAdminClient();

  /* =========================================================
     URLs TEMPORÁRIAS DOS DOCUMENTOS

     Storage é privado.
  ========================================================= */

  const documentsWithUrls =
    await Promise.all(
      documents.map(
        async (document) => {
          if (
            !document.storage_path
          ) {
            return {
              ...document,
              signedUrl:
                null as string | null,
            };
          }

          const {
            data,
            error: signedUrlError,
          } = await admin.storage
            .from(
              'client-documents',
            )
            .createSignedUrl(
              document.storage_path,
              60 * 10,
            );

          if (signedUrlError) {
            console.error(
              'Erro ao criar URL assinada:',
              signedUrlError,
            );

            return {
              ...document,
              signedUrl:
                null as string | null,
            };
          }

          return {
            ...document,
            signedUrl:
              data.signedUrl,
          };
        },
      ),
    );

  /* =========================================================
     ASSOCIAR DOCUMENTOS AOS PEDIDOS

     Isto permite mostrar:

     Recibos de vencimento
     2 / 3 recebidos
  ========================================================= */

  const requestsWithDocuments =
    documentRequests.map(
      (request) => {
        const requestDocuments =
          documentsWithUrls.filter(
            (document) =>
              document.request_id ===
              request.id,
          );

        return {
          ...request,

          documents:
            requestDocuments,

          receivedCount:
            requestDocuments.filter(
              (document) =>
                document.status ===
                  'received' ||
                document.status ===
                  'signed',
            ).length,
        };
      },
    );

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/processos"
          className="text-sm font-medium text-gray-500 transition hover:text-[#006571]"
        >
          ← Processos
        </Link>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-950">
                {process.reference ??
                  'Processo'}
              </h1>

              <StatusBadge
                status={
                  process.status
                }
              />
            </div>

            {client && (
              <p className="mt-2 text-sm text-gray-500">
                Cliente:{' '}
                <Link
                  href={`/clientes/${client.id}`}
                  className="font-medium text-[#006571] hover:underline"
                >
                  {client.full_name}
                </Link>
              </p>
            )}
          </div>

          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Alterar estado
          </button>
        </div>
      </div>

      <ProcessTabsContent
        processData={{
          id: process.id,

          reference:
            process.reference,

          status:
            process.status,

          requested_amount:
            process.requested_amount,

          down_payment:
            process.down_payment,

          term_months:
            process.term_months,

          vehicle_make:
            process.vehicle_make,

          vehicle_model:
            process.vehicle_model,

          vehicle_version:
            process.vehicle_version,

          vehicle_year:
            process.vehicle_year,

          vehicle_registration:
            process.vehicle_registration,

          vehicle_price:
            process.vehicle_price,

          notes:
            process.notes,

          created_at:
            process.created_at,

          updated_at:
            process.updated_at,

          client,

          documents:
            documentsWithUrls,

          documentRequests:
            requestsWithDocuments,
        }}
        portalComponent={
          <GenerateClientPortalLink
            processId={
              process.id
            }
          />
        }
      />
    </div>
  );
}

/* =========================================================
   STATUS
========================================================= */

const statusLabels: Record<
  string,
  string
> = {
  new: 'Novo',

  documentation:
    'Documentação',

  ready_for_analysis:
    'Pronto para análise',

  sent_to_lender:
    'Enviado para financeira',

  under_analysis:
    'Em análise',

  approved:
    'Aprovado',

  rejected:
    'Recusado',

  cancelled:
    'Cancelado',

  completed:
    'Concluído',
};

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span className="rounded-full bg-[#1693A0]/10 px-3 py-1 text-xs font-semibold text-[#006571]">
      {statusLabels[status] ??
        status}
    </span>
  );
}