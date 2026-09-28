'use client';

import {
  useState,
  type ReactNode,
} from 'react';

import RequestDocumentsButton from '@/components/processos/request-documents-button';
import {
  DOCUMENT_STATUS_LABELS,
  PROCESS_STATUS_LABELS,
  describeProcessEvent,
  getCreditTypeLabel,
  getDocumentTypeLabel,
} from '@/lib/crm/labels';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
} from '@/lib/format';

type Tab =
  | 'resumo'
  | 'cliente'
  | 'credito'
  | 'documentos'
  | 'financeiras'
  | 'historico';

type ClientData = {
  id: string;
  full_name: string | null;
  nif: string | null;
  identification_number: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  notes: string | null;
} | null;

type DocumentData = {
  id: string;
  request_id: string | null;
  type: string;
  status: string;
  file_name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};
type DocumentRequestData = {
  id: string;
  process_id: string;
  client_id: string;

  type: string;
  label: string;

  instructions:
    | string
    | null;

  quantity_required: number;

  status: string;

  created_at: string;
  updated_at: string;

  documents: DocumentData[];

  receivedCount: number;

  proposal_id: string | null;
  bankName: string | null;
};

type ProcessData = {
  id: string;
  reference: string | null;
  status: string;

  requested_amount:
    | number
    | null;

  down_payment:
    | number
    | null;

  term_months:
    | number
    | null;

  vehicle_make:
    | string
    | null;

  vehicle_model:
    | string
    | null;

  vehicle_version:
    | string
    | null;

  vehicle_year:
    | number
    | null;

  vehicle_registration:
    | string
    | null;

  vehicle_price:
    | number
    | null;

  notes:
    | string
    | null;

  credit_type: string;
  vehicle_imported: boolean;

  supplier: NamedEntity;
  commercial: TeamMember;
  assistant: TeamMember;
  administrative: TeamMember;

  created_at: string;
  updated_at: string;

  client: ClientData;

  documents: DocumentData[];
  documentRequests: DocumentRequestData[];

  events: EventData[];
};

type EventData = {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
  created_at: string;
  author: string | null;
};

type NamedEntity = {
  id: string;
  name: string;
} | null;

type TeamMember = {
  id: string;
  full_name: string;
} | null;

type Props = {
  processData: ProcessData;
  participantsComponent: ReactNode;
  stageComponent: ReactNode;
  proposalsComponent: ReactNode;
  tasksComponent: ReactNode;
  portalComponent: ReactNode;
};

const tabs: {
  id: Tab;
  label: string;
}[] = [
  {
    id: 'resumo',
    label: 'Resumo',
  },
  {
    id: 'cliente',
    label: 'Intervenientes',
  },
  {
    id: 'credito',
    label: 'Crédito',
  },
  {
    id: 'documentos',
    label: 'Documentos',
  },
  {
    id: 'financeiras',
    label: 'Propostas',
  },
  {
    id: 'historico',
    label: 'Histórico',
  },
];

export default function ProcessTabsContent({
  processData,
  participantsComponent,
  stageComponent,
  proposalsComponent,
  tasksComponent,
  portalComponent,
}: Props) {
  const [
    activeTab,
    setActiveTab,
  ] = useState<Tab>('resumo');

  return (
    <div className="space-y-6">
      {/* ABAS */}

      <div className="overflow-x-auto border-b border-gray-200">
        <div className="flex min-w-max gap-6">
          {tabs.map((tab) => {
            const active =
              activeTab ===
              tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab.id,
                  )
                }
                className={[
                  'border-b-2 px-1 pb-3 text-sm font-medium transition',
                  active
                    ? 'border-[#006571] text-[#006571]'
                    : 'border-transparent text-gray-400 hover:text-gray-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* RESUMO */}

      {activeTab ===
        'resumo' && (
        <ResumoTab
          processData={
            processData
          }
          stageComponent={
            stageComponent
          }
          tasksComponent={
            tasksComponent
          }
          portalComponent={
            portalComponent
          }
        />
      )}

      {/* CLIENTE */}

      {activeTab ===
        'cliente' && (
        <div className="space-y-6">
          {participantsComponent}

          <ClienteTab
            client={
              processData.client
            }
          />
        </div>
      )}

      {/* CRÉDITO */}

      {activeTab ===
        'credito' && (
        <CreditoTab
          processData={
            processData
          }
        />
      )}

      {/* DOCUMENTOS */}

     {activeTab === 'documentos' && (
    <DocumentosTab
        processId={processData.id}
        documents={processData.documents}
        documentRequests={
        processData.documentRequests
        }
        portalComponent={
        portalComponent
        }
    />
    )}

      {/* PROPOSTAS AOS BANCOS */}

      {activeTab ===
        'financeiras' && (
        proposalsComponent
      )}

      {/* HISTÓRICO */}

      {activeTab ===
        'historico' && (
        <HistoricoTab
          processData={
            processData
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   RESUMO
========================================================= */

function ResumoTab({
  processData,
  stageComponent,
  tasksComponent,
  portalComponent,
}: {
  processData: ProcessData;
  stageComponent: ReactNode;
  tasksComponent: ReactNode;
  portalComponent: ReactNode;
}) {
  const {
    client,
  } = processData;

  const completedRequests =
    processData.documentRequests.filter(
      (request) =>
        request.status ===
          'completed' ||
        request.receivedCount >=
          request.quantity_required,
    ).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {/* FASES */}

        {stageComponent}

        {/* FINANCIAMENTO */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-950">
            Financiamento
          </h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Info
              label="Tipo de crédito"
              value={getCreditTypeLabel(
                processData.credit_type,
              )}
            />

            <Info
              label="Montante solicitado"
              value={formatCurrency(
                processData.requested_amount,
              )}
            />

            <Info
              label="Entrada"
              value={formatCurrency(
                processData.down_payment,
              )}
            />

            <Info
              label="Prazo"
              value={
                processData.term_months
                  ? `${processData.term_months} meses`
                  : '—'
              }
            />

            {processData.credit_type === 'auto' && (
              <Info
                label="Preço da viatura"
                value={formatCurrency(
                  processData.vehicle_price,
                )}
              />
            )}
          </div>
        </section>

        {processData.credit_type === 'auto' && (
          <>
            {/* VIATURA */}

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-gray-950">
                  Viatura
                </h2>

                {processData.vehicle_imported && (
                  <ImportedBadge />
                )}
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Info
                  label="Marca"
                  value={
                    processData.vehicle_make
                  }
                />

                <Info
                  label="Modelo"
                  value={
                    processData.vehicle_model
                  }
                />

                <Info
                  label="Versão"
                  value={
                    processData.vehicle_version
                  }
                />

                <Info
                  label="Ano"
                  value={
                    processData.vehicle_year
                  }
                />

                <Info
                  label="Matrícula"
                  value={
                    processData.vehicle_registration
                  }
                />
              </div>
            </section>
          </>
        )}

        {/* DOCUMENTAÇÃO */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-950">
                Documentação
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                Estado dos documentos solicitados ao cliente.
              </p>
            </div>

            <span className="text-sm text-gray-400">
              {completedRequests} de{' '}
              {
                processData
                  .documentRequests
                  .length
              }{' '}
              concluídos
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {processData
              .documentRequests
              .length === 0 ? (
              <EmptyState
                title="Sem pedidos de documentação"
                description="Ainda não foram solicitados documentos neste processo."
              />
            ) : (
              processData
                .documentRequests
                .slice(0, 6)
                .map(
                  (request) => {
                    const complete =
                      request.status ===
                        'completed' ||
                      request.receivedCount >=
                        request.quantity_required;

                    const partial =
                      request.receivedCount >
                        0 &&
                      !complete;

                    const signed =
                      request.type ===
                        'rgpd' &&
                      request.documents.some(
                        (
                          document,
                        ) =>
                          document.status ===
                          'signed',
                      );

                    return (
                      <div
                        key={
                          request.id
                        }
                        className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800">
                              {
                                request.label
                              }
                            </p>

                            <span
                              className={[
                                'rounded-full px-2.5 py-1 text-xs font-semibold',

                                complete
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : partial
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-amber-50 text-amber-700',
                              ].join(
                                ' ',
                              )}
                            >
                              {complete
                                ? signed
                                  ? 'Assinado'
                                  : 'Concluído'
                                : partial
                                  ? 'Parcial'
                                  : 'Pendente'}
                            </span>
                          </div>

                          <p className="mt-1.5 text-xs text-gray-400">
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

                          {request.instructions && (
                            <p className="mt-1 text-xs leading-5 text-gray-400">
                              {
                                request.instructions
                              }
                            </p>
                          )}
                        </div>

                        {complete ? (
                          <span className="shrink-0 text-sm font-medium text-emerald-600">
                            ✓ Concluído
                          </span>
                        ) : (
                          <span className="shrink-0 text-sm font-medium text-amber-600">
                            Pendente
                          </span>
                        )}
                      </div>
                    );
                  },
                )
            )}
          </div>
        </section>

        {/* NOTAS */}

        {processData.notes && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-950">
              Notas
            </h2>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">
              {
                processData.notes
              }
            </p>
          </section>
        )}
      </div>

      {/* COLUNA DIREITA */}

      <div className="space-y-6">
        {/* CLIENTE */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-950">
            Cliente
          </h2>

          {client ? (
            <div className="mt-6 space-y-5">
              <Info
                label="Nome"
                value={
                  client.full_name
                }
              />

              <Info
                label="NIF"
                value={
                  client.nif
                }
              />

              <Info
                label="Email"
                value={
                  client.email
                }
              />

              <Info
                label="Telefone"
                value={
                  client.phone
                }
              />
            </div>
          ) : (
            <p className="mt-5 text-sm text-gray-400">
              Cliente não encontrado.
            </p>
          )}
        </section>

        {/* TAREFAS */}

        {tasksComponent}

        {/* FORNECEDOR E EQUIPA */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-950">
            Fornecedor e equipa
          </h2>

          <div className="mt-6 space-y-5">
            <Info
              label="Fornecedor do bem"
              value={processData.supplier?.name}
            />

            <Info
              label="Comercial"
              value={processData.commercial?.full_name}
            />

            <Info
              label="Assistente"
              value={processData.assistant?.full_name}
            />

            <Info
              label="Administrativo F"
              value={processData.administrative?.full_name}
            />
          </div>
        </section>

        {/* PORTAL */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-950">
            Portal do cliente
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Gere ou abra o portal privado utilizado pelo
            cliente para tratar da documentação deste processo.
          </p>

          <div className="mt-5">
            {portalComponent}
          </div>
        </section>

        {/* PROCESSO */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-950">
            Processo
          </h2>

          <div className="mt-6 space-y-5">
            <Info
              label="Referência"
              value={
                processData.reference
              }
            />

            <Info
              label="Estado"
              value={
                PROCESS_STATUS_LABELS[
                  processData.status
                ] ??
                processData.status
              }
            />

            <Info
              label="Criado em"
              value={formatDateTime(
                processData.created_at,
              )}
            />

            <Info
              label="Atualizado em"
              value={formatDateTime(
                processData.updated_at,
              )}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/* =========================================================
   CLIENTE
========================================================= */

function ClienteTab({
  client,
}: {
  client: ClientData;
}) {
  if (!client) {
    return (
      <EmptyState
        title="Cliente não encontrado"
        description="Não foi possível carregar os dados do cliente."
      />
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">
          Dados do cliente
        </h2>

        <p className="mt-1 text-sm text-gray-400">
          Informação do titular
          deste processo.
        </p>
      </div>

      <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        <Info
          label="Nome"
          value={client.full_name}
        />

        <Info
          label="NIF"
          value={client.nif}
        />

        <Info
          label="Documento de identificação"
          value={
            client.identification_number
          }
        />

        <Info
          label="Data de nascimento"
          value={
            client.birth_date
              ? formatDate(
                  client.birth_date,
                )
              : null
          }
        />

        <Info
          label="Email"
          value={client.email}
        />

        <Info
          label="Telefone"
          value={client.phone}
        />

        <Info
          label="Morada"
          value={client.address}
        />

        <Info
          label="Código postal"
          value={
            client.postal_code
          }
        />

        <Info
          label="Localidade"
          value={client.city}
        />
      </div>

      {client.notes && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Notas
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
            {client.notes}
          </p>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   CRÉDITO
========================================================= */

function CreditoTab({
  processData,
}: {
  processData: ProcessData;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-950">
          Crédito
        </h2>

        <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          <Info
            label="Tipo de crédito"
            value={getCreditTypeLabel(
              processData.credit_type,
            )}
          />

          <Info
            label="Montante solicitado"
            value={formatCurrency(
              processData.requested_amount,
            )}
          />

          <Info
            label="Entrada"
            value={formatCurrency(
              processData.down_payment,
            )}
          />

          <Info
            label="Prazo"
            value={
              processData.term_months
                ? `${processData.term_months} meses`
                : null
            }
          />

          {processData.credit_type === 'auto' && (
            <Info
              label="Preço da viatura"
              value={formatCurrency(
                processData.vehicle_price,
              )}
            />
          )}
        </div>
      </section>

      {processData.credit_type === 'auto' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-950">
              Viatura
            </h2>

            {processData.vehicle_imported && (
              <ImportedBadge />
            )}
          </div>

          <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            <Info
              label="Marca"
              value={
                processData.vehicle_make
              }
            />

            <Info
              label="Modelo"
              value={
                processData.vehicle_model
              }
            />

            <Info
              label="Versão"
              value={
                processData.vehicle_version
              }
            />

            <Info
              label="Ano"
              value={
                processData.vehicle_year
              }
            />

            <Info
              label="Matrícula"
              value={
                processData.vehicle_registration
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}

/* =========================================================
   DOCUMENTOS
========================================================= */
function DocumentosTab({
  processId,
  documentRequests,
  portalComponent,
}: {
  processId: string;
  documents: DocumentData[];
  documentRequests: DocumentRequestData[];
  portalComponent: ReactNode;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Documentação
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Pedidos e documentos recebidos deste processo.
            </p>
          </div>

          <span className="text-sm text-gray-400">
            {documentRequests.length}{' '}
            {documentRequests.length === 1
              ? 'pedido'
              : 'pedidos'}
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {documentRequests.length === 0 ? (
            <EmptyState
              title="Ainda não existem pedidos"
              description="Os documentos solicitados ao cliente irão aparecer aqui."
            />
          ) : (
            documentRequests.map(
              (request) => {
                const complete =
                  request.status ===
                    'completed' ||
                  request.receivedCount >=
                    request.quantity_required;

                const partial =
                  request.receivedCount >
                    0 &&
                  !complete;

                const signed =
                  request.type ===
                    'rgpd' &&
                  request.documents.some(
                    (document) =>
                      document.status ===
                      'signed',
                  );

                return (
                  <div
                    key={request.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800">
                            {request.label}
                          </p>

                          {request.bankName && (
                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                              Pedido por {request.bankName}
                            </span>
                          )}

                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-xs font-semibold',

                              complete
                                ? 'bg-emerald-50 text-emerald-700'
                                : partial
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-50 text-amber-700',
                            ].join(
                              ' ',
                            )}
                          >
                            {complete
                              ? signed
                                ? 'Assinado'
                                : 'Concluído'
                              : partial
                                ? 'Parcial'
                                : 'Pendente'}
                          </span>
                        </div>

                        <p className="mt-1.5 text-xs text-gray-400">
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

                        {request.instructions && (
                          <p className="mt-1 text-xs leading-5 text-gray-400">
                            {
                              request.instructions
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    {request.documents.length >
                      0 && (
                      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                        {request.documents.map(
                          (document) => (
                            <DocumentRow
                              key={
                                document.id
                              }
                              document={
                                document
                              }
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )
          )}
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-950">
            Portal do cliente
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Envie este link ao cliente para preencher o RGPD
            e enviar os documentos solicitados.
          </p>

          <div className="mt-5">
            {portalComponent}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006571]/10 text-[#006571]">
            <DocumentIcon />
          </div>

          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            Pedir documentação
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Selecione os documentos necessários para este
            processo. O cliente poderá enviá-los através do
            portal.
          </p>

          <div className="mt-5">
            <RequestDocumentsButton
              processId={
                processId
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}


function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6" />
      <path d="M9 15h6" />
    </svg>
  );
}

/* =========================================================
   HISTÓRICO
========================================================= */

function HistoricoTab({
  processData,
}: {
  processData: ProcessData;
}) {
  /*
   * Eventos registados + documentos recebidos/assinados,
   * do mais recente para o mais antigo.
   */
  const items = [
    ...processData.events.map((event) => ({
      key: `event-${event.id}`,
      title: describeProcessEvent(event.type, event.data),
      author: event.author,
      date: event.created_at,
    })),

    ...processData.documents
      .filter(
        (document) =>
          document.status === 'received' ||
          document.status === 'rejected',
      )
      .map((document) => ({
        key: `document-${document.id}`,
        title: `${getDocumentTypeLabel(
          document.type,
          document.file_name,
        )} — ${
          DOCUMENT_STATUS_LABELS[document.status] ?? document.status
        }`,
        author: null,
        date: document.created_at,
      })),
  ].sort((first, second) => second.date.localeCompare(first.date));

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-950">
        Histórico
      </h2>

      <div className="mt-7 space-y-6">
        {items.length === 0 && (
          <p className="text-sm text-gray-400">Sem registos.</p>
        )}

        {items.map((item) => (
          <HistoryItem
            key={item.key}
            title={item.title}
            date={`${formatDateTime(item.date)}${
              item.author ? ` · ${item.author}` : ''
            }`}
          />
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   AUXILIARES
========================================================= */

function DocumentRow({
  document,
}: {
  document: DocumentData;
}) {
  const hasFile =
    Boolean(
      document.storage_path,
    );

  const viewUrl =
    `/api/crm/documents/${encodeURIComponent(
      document.id,
    )}?mode=view`;

  const downloadUrl =
    `/api/crm/documents/${encodeURIComponent(
      document.id,
    )}?mode=download`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-800">
            {getDocumentTypeLabel(
              document.type,
              document.file_name,
            )}
          </p>

          <DocumentStatusBadge
            status={
              document.status
            }
          />
        </div>

        {document.signed_at && (
          <p className="mt-1 text-xs text-gray-400">
            Assinado em{' '}
            {formatDateTime(
              document.signed_at,
            )}
          </p>
        )}

        {document.file_name && (
          <p className="mt-1 truncate text-xs text-gray-400">
            {
              document.file_name
            }
          </p>
        )}

        {document.file_size && (
          <p className="mt-1 text-xs text-gray-400">
            {formatFileSize(
              document.file_size,
            )}
          </p>
        )}
      </div>

      {hasFile ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Ver
          </a>

          <a
            href={downloadUrl}
            className="rounded-lg bg-[#006571] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#00535d]"
          >
            Descarregar
          </a>
        </div>
      ) : (
        <span className="text-xs text-gray-400">
          Sem ficheiro
        </span>
      )}
    </div>
  );
}

function DocumentStatusBadge({
  status,
}: {
  status: string;
}) {
  let className =
    'bg-amber-50 text-amber-700';

  if (
    status === 'signed' ||
    status === 'received'
  ) {
    className =
      'bg-emerald-50 text-emerald-700';
  }

  if (status === 'rejected') {
    className =
      'bg-red-50 text-red-700';
  }

  return (
    <span
      className={[
        'rounded-full px-2.5 py-1 text-xs font-semibold',
        className,
      ].join(' ')}
    >
      {DOCUMENT_STATUS_LABELS[
        status
      ] ?? status}
    </span>
  );
}

function ImportedBadge() {
  return (
    <span
      title="Viatura importada"
      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      Importada
    </span>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number
    | null
    | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-gray-800">
        {value === null ||
        value === undefined ||
        value === ''
          ? '—'
          : value}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
      <p className="font-medium text-gray-800">
        {title}
      </p>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-400">
        {description}
      </p>
    </div>
  );
}

function HistoryItem({
  title,
  date,
}: {
  title: string;
  date: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1693A0]" />

      <div>
        <p className="text-sm font-medium text-gray-800">
          {title}
        </p>

        <p className="mt-1 text-xs text-gray-400">
          {date}
        </p>
      </div>
    </div>
  );
}

