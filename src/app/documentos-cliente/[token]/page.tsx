import { notFound } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import StartRgpdButton from '@/components/client-portal/start-rgpd-button';
import {
  hashClientPortalToken,
} from '@/lib/client-portal/tokens';
import { DOCUMENT_TYPE_LABELS } from '@/lib/crm/labels';
import { isExpired } from '@/lib/format';

import DocumentUpload from '@/components/client-portal/document-upload';

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ClientDocumentsPage({
  params,
}: Props) {
  const { token } = await params;

  if (!token || token.length > 200) {
    notFound();
  }

  const tokenHash =
    hashClientPortalToken(token);

  const admin =
    createAdminClient();

  /* =========================================================
     TOKEN DO PORTAL
  ========================================================= */

  const {
    data: portalToken,
    error: tokenError,
  } = await admin
    .from('client_portal_tokens')
    .select(`
      id,
      process_id,
      expires_at,
      revoked_at
    `)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError || !portalToken) {
    notFound();
  }

  const expired =
    isExpired(portalToken.expires_at);

  if (
    expired ||
    portalToken.revoked_at
  ) {
    return <InvalidPortal />;
  }

  /* =========================================================
     PROCESSO + CLIENTE, PEDIDOS E DOCUMENTOS

     Tudo depende apenas do process_id do portal,
     por isso as consultas correm em paralelo.
  ========================================================= */

  const processId =
    portalToken.process_id;

  const [
    {
      data: creditProcess,
      error: processError,
    },
    {
      data: requests,
      error: requestsError,
    },
    {
      data: documents,
      error: documentsError,
    },
  ] = await Promise.all([
    admin
      .from('credit_processes')
      .select(`
        id,
        reference,
        client_id,
        clients!client_id (
          id,
          full_name
        )
      `)
      .eq('id', processId)
      .maybeSingle(),

    admin
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
      .eq('process_id', processId)
      .neq('status', 'cancelled')
      .order('created_at', {
        ascending: true,
      }),

    admin
      .from('documents')
      .select(`
        id,
        request_id,
        type,
        status,
        file_name,
        signed_at,
        created_at
      `)
      .eq('process_id', processId)
      .order('created_at', {
        ascending: true,
      }),
  ]);

  if (
    processError ||
    !creditProcess
  ) {
    notFound();
  }

  const client = Array.isArray(
    creditProcess.clients,
  )
    ? creditProcess.clients[0] ?? null
    : creditProcess.clients;

  if (requestsError) {
    console.error(
      'Erro ao carregar pedidos:',
      requestsError,
    );
  }

  const requestList =
    requests ?? [];

  if (documentsError) {
    console.error(
      'Erro ao carregar documentos:',
      documentsError,
    );
  }

  const documentList =
    documents ?? [];

  /* =========================================================
     ASSOCIAR DOCUMENTOS A CADA PEDIDO
  ========================================================= */

  const requestsWithDocuments =
    requestList.map(
      (request) => {
        const requestDocuments =
          documentList.filter(
            (document) =>
              document.request_id ===
              request.id,
          );

        const receivedCount =
          requestDocuments.filter(
            (document) =>
              document.status ===
                'received' ||
              document.status ===
                'signed',
          ).length;

        const complete =
          request.status ===
            'completed' ||
          receivedCount >=
            request.quantity_required;

        return {
          ...request,
          documents:
            requestDocuments,
          receivedCount,
          complete,
        };
      },
    );

  /* =========================================================
     RGPD LEGADO / ASSINADO SEM REQUEST_ID

     Isto evita perder um RGPD já assinado que tenha sido
     criado antes da nova arquitetura de document_requests.
  ========================================================= */

  const signedRgpdWithoutRequest =
    documentList.find(
      (document) =>
        document.type ===
          'rgpd' &&
        document.status ===
          'signed' &&
        !document.request_id,
    );

  const hasRgpdRequest =
    requestsWithDocuments.some(
      (request) =>
        request.type ===
        'rgpd',
    );

  if (
    signedRgpdWithoutRequest &&
    !hasRgpdRequest
  ) {
    requestsWithDocuments.unshift({
      id: `legacy-rgpd-${signedRgpdWithoutRequest.id}`,
      process_id:
        creditProcess.id,
      client_id:
        creditProcess.client_id,
      type: 'rgpd',
      label: 'RGPD',
      instructions: null,
      quantity_required: 1,
      status: 'completed',
      created_at:
        signedRgpdWithoutRequest.created_at,
      updated_at:
        signedRgpdWithoutRequest.created_at,
      documents: [
        signedRgpdWithoutRequest,
      ],
      receivedCount: 1,
      complete: true,
    });
  }

  /* =========================================================
     PROGRESSO
  ========================================================= */

  const completedRequests =
    requestsWithDocuments.filter(
      (request) =>
        request.complete,
    ).length;

  const totalRequests =
    requestsWithDocuments.length;

  const progress =
    totalRequests > 0
      ? Math.round(
          (
            completedRequests /
            totalRequests
          ) * 100,
        )
      : 0;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#F7F9FA]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
          <div>
            <p className="text-xl font-bold tracking-tight text-[#006571]">
              CrediAuto
            </p>

            <p className="mt-0.5 text-xs text-gray-400">
              Miranda & Cunha Lda
            </p>
          </div>

          <span className="rounded-full bg-[#1693A0]/10 px-3 py-1.5 text-xs font-semibold text-[#006571]">
            Portal seguro
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <section>
          <p className="text-sm font-medium text-[#006571]">
            Processo{' '}
            {creditProcess.reference}
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
            Documentação
          </h1>

          {client?.full_name && (
            <p className="mt-2 text-sm text-gray-500">
              Cliente:{' '}
              <span className="font-medium text-gray-700">
                {client.full_name}
              </span>
            </p>
          )}

          <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-500">
            Envie abaixo os documentos solicitados para este processo.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-5">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Estado da documentação
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {completedRequests} de{' '}
                {totalRequests}{' '}
                pedidos concluídos
              </p>
            </div>

            <div className="text-2xl font-semibold text-[#006571]">
              {progress}%
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#1693A0]"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </section>

        <section className="mt-6 space-y-3">
          {requestsWithDocuments.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <p className="font-medium text-gray-700">
                Ainda não foram pedidos documentos.
              </p>

              <p className="mt-2 text-sm text-gray-400">
                A CrediAuto irá indicar aqui os documentos necessários.
              </p>
            </div>
          ) : (
            requestsWithDocuments.map(
              (request) => {
                const isRgpd =
                  request.type ===
                  'rgpd';

                return (
                  <article
                    key={request.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold text-gray-900">
                            {request.label ||
                              DOCUMENT_TYPE_LABELS[
                                request.type
                              ] ||
                              'Documento'}
                          </h2>

                          <RequestStatusBadge
                            complete={
                              request.complete
                            }
                            partial={
                              request.receivedCount >
                                0 &&
                              !request.complete
                            }
                            signed={
                              isRgpd &&
                              request.documents.some(
                                (
                                  document,
                                ) =>
                                  document.status ===
                                  'signed',
                              )
                            }
                          />
                        </div>

                        {request.instructions && (
                          <p className="mt-1.5 text-xs leading-5 text-gray-400">
                            {
                              request.instructions
                            }
                          </p>
                        )}

                        <p className="mt-2 text-xs font-medium text-gray-500">
                          {
                            request.receivedCount
                          }{' '}
                          de{' '}
                          {
                            request.quantity_required
                          }{' '}
                          recebido
                          {request.quantity_required !==
                          1
                            ? 's'
                            : ''}
                        </p>

                        {request.documents
                            .filter(
                                (document) =>
                                document.status === 'received' ||
                                document.status === 'signed',
                            )
                            .map(
                                (document) => (
                                <p
                                    key={document.id}
                                    className="mt-1 text-xs text-gray-400"
                                >
                                    {document.file_name ??
                                    (document.status === 'signed'
                                        ? 'Documento assinado'
                                        : 'Documento recebido')}
                                </p>
                                ),
                            )}
                      </div>

                      <div className="shrink-0">
                        {!request.complete &&
                          isRgpd && (
                            <StartRgpdButton
                              portalToken={
                                token
                              }
                              requestId={
                                request.id
                              }
                            />
                          )}

                        {!request.complete &&
                            !isRgpd && (
                                <DocumentUpload
                                portalToken={
                                    token
                                }
                                requestId={
                                    request.id
                                }
                                receivedCount={
                                    request.receivedCount
                                }
                                quantityRequired={
                                    request.quantity_required
                                }
                                />
                            )}

                        {request.complete && (
                          <span className="text-sm font-medium text-emerald-600">
                            ✓ Concluído
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              },
            )
          )}
        </section>

        <p className="mt-8 text-center text-xs leading-5 text-gray-400">
          Este link é pessoal e destina-se exclusivamente à documentação deste processo.
        </p>
      </div>
    </main>
  );
}

function RequestStatusBadge({
  complete,
  partial,
  signed,
}: {
  complete: boolean;
  partial: boolean;
  signed: boolean;
}) {
  if (complete) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        {signed
          ? 'Assinado'
          : 'Concluído'}
      </span>
    );
  }

  if (partial) {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        Parcial
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      Pendente
    </span>
  );
}

function InvalidPortal() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FA] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-xl">
          !
        </div>

        <h1 className="mt-5 text-xl font-semibold text-gray-950">
          Link indisponível
        </h1>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Este link expirou ou foi substituído. Contacte a CrediAuto para obter um novo link.
        </p>
      </div>
    </main>
  );
}