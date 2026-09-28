import Link from 'next/link';
import { notFound } from 'next/navigation';

import ProcessTabsContent from '@/components/processos/process-tabs-content';
import ProcessParticipants from '@/components/processos/process-participants';
import LenderProposals from '@/components/processos/lender-proposals';
import ProcessTasks from '@/components/processos/process-tasks';
import ProcessStage from '@/components/processos/process-stage';
import GenerateClientPortalLink from '@/components/processos/generate-client-portal-link';

import { createClient } from '@/lib/supabase/server';
import { getProcessStatusLabel } from '@/lib/crm/labels';
import { todayIsoDate } from '@/lib/format';

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
     PROCESSO + PEDIDOS DE DOCUMENTOS

     Pedidos são os criados pelo botão "Pedir documentos".
     As duas consultas correm em paralelo (ambas por RLS).
  ========================================================= */

  const [
    {
      data: process,
      error,
    },
    {
      data: documentRequestsRaw,
      error: documentRequestsError,
    },
    {
      data: participantsRaw,
      error: participantsError,
    },
    {
      data: clientOptions,
    },
    {
      data: proposalsRaw,
      error: proposalsError,
    },
    {
      data: bankOptions,
    },
    {
      data: tasksRaw,
      error: tasksError,
    },
    {
      data: teamOptions,
    },
    {
      data: eventsRaw,
      error: eventsError,
    },
  ] = await Promise.all([
    supabase
      .from('credit_processes')
      .select(`
        id,
        reference,
        status,
        credit_type,
        requested_amount,
        down_payment,
        term_months,

        vehicle_make,
        vehicle_model,
        vehicle_version,
        vehicle_year,
        vehicle_registration,
        vehicle_price,
        vehicle_imported,

        notes,

        approved_proposal_id,
        contract_received_on,
        contract_deadline,
        contract_resolved_at,
        funding_status,
        registration_deadline,
        registration_verified_on,

        supplier:suppliers (
          id,
          name
        ),

        commercial:profiles!commercial_id (
          id,
          full_name
        ),

        assistant:profiles!assistant_id (
          id,
          full_name
        ),

        administrative:profiles!administrative_id (
          id,
          full_name
        ),

        client_id,

        created_at,
        updated_at,

        clients!client_id (
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
          client_id,
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
      .single(),

    supabase
      .from('document_requests')
      .select(`
        id,
        process_id,
        client_id,
        proposal_id,
        type,
        label,
        instructions,
        quantity_required,
        status,
        created_at,
        updated_at
      `)
      .eq('process_id', id)
      .neq('status', 'cancelled')
      .order('created_at', {
        ascending: true,
      }),

    supabase
      .from('process_participants')
      .select(`
        id,
        role,
        client_id,
        clients (
          id,
          full_name,
          nif,
          email,
          phone
        )
      `)
      .eq('process_id', id)
      .order('created_at', {
        ascending: true,
      }),

    supabase
      .from('clients')
      .select('id, full_name, nif')
      .order('full_name', {
        ascending: true,
      }),

    supabase
      .from('lender_proposals')
      .select(`
        id,
        status,
        submitted_at,
        decided_at,
        reason,
        approved_amount,
        approved_term_months,
        notes,
        bank:banks (
          id,
          name
        )
      `)
      .eq('process_id', id)
      .order('submitted_at', {
        ascending: false,
      }),

    supabase
      .from('banks')
      .select('id, name')
      .eq('active', true)
      .order('name', {
        ascending: true,
      }),

    supabase
      .from('process_tasks')
      .select(`
        id,
        title,
        description,
        kind,
        due_date,
        done_at,
        assignee:profiles!assigned_to (
          id,
          full_name
        )
      `)
      .eq('process_id', id)
      .order('done_at', {
        ascending: true,
        nullsFirst: true,
      })
      .order('due_date', {
        ascending: true,
        nullsFirst: false,
      }),

    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name', {
        ascending: true,
      }),

    supabase
      .from('process_events')
      .select(`
        id,
        type,
        data,
        created_at,
        author:profiles!created_by (
          full_name
        )
      `)
      .eq('process_id', id)
      .order('created_at', {
        ascending: false,
      })
      .limit(200),
  ]);

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

  if (participantsError) {
    console.error(
      'Erro ao carregar intervenientes:',
      participantsError,
    );
  }

  const participants = (participantsRaw ?? []).map(
    (participant) => {
      const rgpdDocuments = documents.filter(
        (document) =>
          document.type === 'rgpd' &&
          document.client_id === participant.client_id,
      );

      return {
        id: participant.id,
        role: participant.role as string,
        client: single(participant.clients),
        rgpdStatus: rgpdDocuments.some(
          (document) => document.status === 'signed',
        )
          ? ('signed' as const)
          : rgpdDocuments.some(
                (document) => document.status === 'pending',
              )
            ? ('pending' as const)
            : ('none' as const),
      };
    },
  );

  if (proposalsError) {
    console.error(
      'Erro ao carregar propostas:',
      proposalsError,
    );
  }

  if (tasksError) {
    console.error(
      'Erro ao carregar tarefas:',
      tasksError,
    );
  }

  if (eventsError) {
    console.error(
      'Erro ao carregar histórico:',
      eventsError,
    );
  }

  const events = (eventsRaw ?? []).map((event) => ({
    id: event.id,
    type: event.type,
    data: event.data as Record<string, unknown> | null,
    created_at: event.created_at,
    author: single(event.author)?.full_name ?? null,
  }));

  const tasks = (tasksRaw ?? []).map((task) => ({
    ...task,
    assignee: single(task.assignee),
  }));

  if (documentRequestsError) {
    console.error(
      'Erro ao carregar pedidos de documentos:',
      documentRequestsError,
    );
  }

  const documentRequests =
    documentRequestsRaw ?? [];

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
          documents.filter(
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
     PROPOSTAS + DOCUMENTOS ADICIONAIS PEDIDOS PELO BANCO
  ========================================================= */

  const proposals = (proposalsRaw ?? []).map((proposal) => ({
    ...proposal,
    bank: single(proposal.bank),
    requests: requestsWithDocuments
      .filter((request) => request.proposal_id === proposal.id)
      .map((request) => ({
        id: request.id,
        label: request.label,
        status: request.status,
        quantity_required: request.quantity_required,
        receivedCount: request.receivedCount,
      })),
  }));

  const bankNamesByProposal = new Map(
    proposals.map((proposal) => [
      proposal.id,
      proposal.bank?.name ?? 'Banco',
    ]),
  );

  const documentRequestsWithBank = requestsWithDocuments.map(
    (request) => ({
      ...request,
      bankName: request.proposal_id
        ? bankNamesByProposal.get(request.proposal_id) ?? 'Banco'
        : null,
    }),
  );

  /* =========================================================
     FASES (contrato, financiamento, averbamento)
  ========================================================= */

  const today = todayIsoDate();

  const stageData = {
    processId: process.id,
    status: process.status,
    today,

    approvedProposals: proposals
      .filter((proposal) => proposal.status === 'approved')
      .map((proposal) => ({
        id: proposal.id,
        bankName: proposal.bank?.name ?? 'Banco',
        approvedAmount: proposal.approved_amount,
      })),

    contractBankName: process.approved_proposal_id
      ? bankNamesByProposal.get(process.approved_proposal_id) ?? null
      : null,
    contractReceivedOn: process.contract_received_on,
    contractDeadline: process.contract_deadline,
    contractResolvedAt: process.contract_resolved_at,

    fundingStatus: process.funding_status,

    registrationDeadline: process.registration_deadline,
    registrationVerifiedOn: process.registration_verified_on,
  };

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

          <Link
            href={`/processos/${process.id}/editar`}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Editar processo
          </Link>
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

          credit_type:
            process.credit_type,

          vehicle_imported:
            process.vehicle_imported,

          supplier:
            single(process.supplier),

          commercial:
            single(process.commercial),

          assistant:
            single(process.assistant),

          administrative:
            single(process.administrative),

          created_at:
            process.created_at,

          updated_at:
            process.updated_at,

          client,

          documents:
            documents,

          documentRequests:
            documentRequestsWithBank,

          events,
        }}
        stageComponent={
          <ProcessStage data={stageData} />
        }
        proposalsComponent={
          <LenderProposals
            processId={process.id}
            creditType={process.credit_type}
            proposals={proposals}
            banks={bankOptions ?? []}
          />
        }
        tasksComponent={
          <ProcessTasks
            processId={process.id}
            tasks={tasks}
            team={teamOptions ?? []}
            today={today}
          />
        }
        participantsComponent={
          <ProcessParticipants
            processId={process.id}
            participants={participants}
            clientOptions={clientOptions ?? []}
          />
        }
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span className="rounded-full bg-[#1693A0]/10 px-3 py-1 text-xs font-semibold text-[#006571]">
      {getProcessStatusLabel(status)}
    </span>
  );
}

/*
 * Relações 1:1 do Supabase podem vir como objeto ou array.
 */
function single<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
