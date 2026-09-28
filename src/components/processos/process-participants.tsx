'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import {
  addParticipantAction,
  removeParticipantAction,
  type AddParticipantInput,
} from '@/app/(crm)/processos/[id]/participants-actions';
import { PARTICIPANT_ROLE_LABELS } from '@/lib/crm/labels';

export type ParticipantData = {
  id: string;
  role: string;
  client: {
    id: string;
    full_name: string;
    nif: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  rgpdStatus: 'signed' | 'pending' | 'none';
};

type ClientOption = {
  id: string;
  full_name: string;
  nif: string | null;
};

type Props = {
  processId: string;
  participants: ParticipantData[];
  clientOptions: ClientOption[];
};

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10';

const emptyNewClient = {
  fullName: '',
  nif: '',
  identificationNumber: '',
  email: '',
  phone: '',
};

export default function ProcessParticipants({
  processId,
  participants,
  clientOptions,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [role, setRole] =
    useState<AddParticipantInput['role']>('second_holder');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [clientId, setClientId] = useState('');
  const [newClient, setNewClient] = useState(emptyNewClient);

  const hasSecondHolder = participants.some(
    (participant) => participant.role === 'second_holder',
  );

  const participantClientIds = new Set(
    participants.map((participant) => participant.client?.id),
  );

  const availableClients = clientOptions.filter(
    (client) => !participantClientIds.has(client.id),
  );

  function resetForm() {
    setFormOpen(false);
    setMode('existing');
    setClientId('');
    setNewClient(emptyNewClient);
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const input: AddParticipantInput =
      mode === 'existing'
        ? { role, mode, clientId }
        : { role, mode, client: newClient };

    startTransition(async () => {
      const result = await addParticipantAction(processId, input);

      if (!result.success) {
        setError(result.message);
        return;
      }

      resetForm();
    });
  }

  function handleRemove(participant: ParticipantData) {
    const name = participant.client?.full_name ?? 'este interveniente';

    if (!window.confirm(`Remover ${name} do processo?`)) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await removeParticipantAction(
        processId,
        participant.id,
      );

      if (!result.success) {
        setError(result.message);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">
            Intervenientes
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Titulares e avalistas. Cada interveniente assina o seu RGPD no portal do cliente.
          </p>
        </div>

        {!formOpen && (
          <button
            type="button"
            onClick={() => {
              setRole(hasSecondHolder ? 'guarantor' : 'second_holder');
              setFormOpen(true);
            }}
            className="shrink-0 rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
          >
            + Adicionar interveniente
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* LISTA */}

      <div className="mt-6 space-y-3">
        {participants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
            Sem intervenientes registados.
          </p>
        ) : (
          participants.map((participant) => (
            <div
              key={participant.id}
              className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {participant.client ? (
                    <Link
                      href={`/clientes/${participant.client.id}`}
                      className="truncate text-sm font-semibold text-gray-900 hover:text-[#006571] hover:underline"
                    >
                      {participant.client.full_name}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-gray-500">
                      Cliente indisponível
                    </span>
                  )}

                  <span className="rounded-full bg-[#006571]/10 px-2.5 py-1 text-xs font-semibold text-[#006571]">
                    {PARTICIPANT_ROLE_LABELS[participant.role] ??
                      participant.role}
                  </span>

                  <RgpdBadge status={participant.rgpdStatus} />
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  {[
                    participant.client?.nif &&
                      `NIF ${participant.client.nif}`,
                    participant.client?.email,
                    participant.client?.phone,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sem contactos registados'}
                </p>
              </div>

              {participant.role !== 'primary_holder' && (
                <button
                  type="button"
                  onClick={() => handleRemove(participant)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  Remover
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* FORMULÁRIO */}

      {formOpen && (
        <form
          onSubmit={handleAdd}
          className="mt-6 space-y-5 rounded-xl border border-gray-200 p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="participant_role"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Papel no processo
              </label>

              <select
                id="participant_role"
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value as AddParticipantInput['role'],
                  )
                }
                className={inputClassName}
              >
                <option value="second_holder" disabled={hasSecondHolder}>
                  2.º titular
                  {hasSecondHolder ? ' (já existe)' : ''}
                </option>
                <option value="guarantor">Avalista</option>
                <option value="other">Outro interveniente</option>
              </select>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Cliente
              </span>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                <ModeButton
                  active={mode === 'existing'}
                  onClick={() => setMode('existing')}
                >
                  Cliente existente
                </ModeButton>

                <ModeButton
                  active={mode === 'new'}
                  onClick={() => setMode('new')}
                >
                  Novo cliente
                </ModeButton>
              </div>
            </div>
          </div>

          {mode === 'existing' ? (
            <select
              aria-label="Selecionar cliente"
              required
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Selecionar cliente...</option>

              {availableClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                  {client.nif ? ` — ${client.nif}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <input
                required
                placeholder="Nome completo *"
                value={newClient.fullName}
                onChange={(event) =>
                  setNewClient({
                    ...newClient,
                    fullName: event.target.value,
                  })
                }
                className={inputClassName}
              />

              <input
                placeholder="NIF"
                inputMode="numeric"
                maxLength={9}
                value={newClient.nif}
                onChange={(event) =>
                  setNewClient({
                    ...newClient,
                    nif: event.target.value,
                  })
                }
                className={inputClassName}
              />

              <input
                placeholder="N.º de identificação (CC)"
                value={newClient.identificationNumber}
                onChange={(event) =>
                  setNewClient({
                    ...newClient,
                    identificationNumber: event.target.value,
                  })
                }
                className={inputClassName}
              />

              <input
                type="email"
                placeholder="Email"
                value={newClient.email}
                onChange={(event) =>
                  setNewClient({
                    ...newClient,
                    email: event.target.value,
                  })
                }
                className={inputClassName}
              />

              <input
                type="tel"
                placeholder="Telefone"
                value={newClient.phone}
                onChange={(event) =>
                  setNewClient({
                    ...newClient,
                    phone: event.target.value,
                  })
                }
                className={inputClassName}
              />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              disabled={isPending}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-[#006571] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d] disabled:opacity-60"
            >
              {isPending ? 'A adicionar...' : 'Adicionar e criar RGPD'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'bg-white text-[#006571] shadow-sm'
          : 'text-gray-500 hover:text-gray-800',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function RgpdBadge({
  status,
}: {
  status: ParticipantData['rgpdStatus'];
}) {
  if (status === 'signed') {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        RGPD assinado
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        RGPD pendente
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      Sem RGPD
    </span>
  );
}
