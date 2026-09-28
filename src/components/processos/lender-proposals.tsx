'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import {
  counterProposalAction,
  createProposalAction,
  decideProposalAction,
  requestProposalDocumentsAction,
} from '@/app/(crm)/processos/[id]/proposals-actions';
import {
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from '@/lib/crm/labels';
import { formatCurrency, formatDateTime } from '@/lib/format';

export type ProposalData = {
  id: string;
  status: string;
  submitted_at: string;
  decided_at: string | null;
  reason: string | null;
  approved_amount: number | null;
  approved_term_months: number | null;
  notes: string | null;
  bank: { id: string; name: string } | null;
  requests: {
    id: string;
    label: string;
    status: string;
    quantity_required: number;
    receivedCount: number;
  }[];
};

type Props = {
  processId: string;
  creditType: string;
  proposals: ProposalData[];
  banks: { id: string; name: string }[];
};

type Panel = 'decision' | 'documents' | 'counter' | null;

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10';

const primaryButton =
  'rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d] disabled:opacity-60';

const secondaryButton =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60';

export default function LenderProposals({
  processId,
  creditType,
  proposals,
  banks,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [bankId, setBankId] = useState('');
  const [notes, setNotes] = useState('');

  const summary = {
    in_analysis: proposals.filter((p) => p.status === 'in_analysis').length,
    approved: proposals.filter((p) => p.status === 'approved').length,
    rejected: proposals.filter((p) => p.status === 'rejected').length,
  };

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createProposalAction(processId, {
        bankId,
        notes,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setBankId('');
      setNotes('');
    });
  }

  return (
    <div className="space-y-6">
      {/* ENVIAR A BANCO */}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Propostas aos bancos
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              O estado do processo acompanha as propostas: alguma aprovada → Aprovado; alguma em análise → Em análise; todas recusadas → Recusado.
            </p>
          </div>

          <div className="flex shrink-0 gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#EAF5F6] px-2.5 py-1 text-[#006571]">
              {summary.in_analysis} em análise
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              {summary.approved} aprovadas
            </span>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
              {summary.rejected} recusadas
            </span>
          </div>
        </div>

        {error && <ErrorBox message={error} />}

        {banks.length === 0 ? (
          <p className="mt-5 text-sm text-gray-500">
            Ainda não existem bancos.{' '}
            <Link
              href="/bancos"
              className="font-medium text-[#006571] hover:underline"
            >
              Adicionar bancos
            </Link>
          </p>
        ) : (
          <form
            onSubmit={handleCreate}
            className="mt-5 grid gap-3 md:grid-cols-[1fr_2fr_auto]"
          >
            <select
              aria-label="Banco"
              required
              value={bankId}
              onChange={(event) => setBankId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Selecionar banco...</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>

            <input
              aria-label="Notas do envio"
              placeholder="Notas do envio (opcional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClassName}
            />

            <button
              type="submit"
              disabled={isPending}
              className={primaryButton}
            >
              Enviar proposta
            </button>
          </form>
        )}
      </section>

      {/* LISTA */}

      {proposals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-400">
          Ainda não foram enviadas propostas para este processo.
        </p>
      ) : (
        proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            processId={processId}
            creditType={creditType}
            proposal={proposal}
          />
        ))
      )}
    </div>
  );
}

/* =========================================================
   CARTÃO DE PROPOSTA
========================================================= */

function ProposalCard({
  processId,
  creditType,
  proposal,
}: {
  processId: string;
  creditType: string;
  proposal: ProposalData;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<{ success: boolean; message?: string }>,
  ) {
    setError(null);

    startTransition(async () => {
      const result = await action();

      if (!result.success) {
        setError(result.message ?? 'Ocorreu um erro.');
        return;
      }

      setPanel(null);
    });
  }

  function toggle(next: Panel) {
    setError(null);
    setPanel(panel === next ? null : next);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-950">
              {proposal.bank?.name ?? 'Banco'}
            </h3>

            <ProposalBadge status={proposal.status} />
          </div>

          <p className="mt-1 text-xs text-gray-400">
            Enviada em {formatDateTime(proposal.submitted_at)}
            {proposal.decided_at &&
              ` · Decidida em ${formatDateTime(proposal.decided_at)}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggle('decision')}
            className={secondaryButton}
          >
            Registar decisão
          </button>

          <button
            type="button"
            onClick={() => toggle('documents')}
            className={secondaryButton}
          >
            Pedir documentos
          </button>

          {proposal.status === 'rejected' && (
            <button
              type="button"
              onClick={() => toggle('counter')}
              className={secondaryButton}
            >
              Contraproposta
            </button>
          )}
        </div>
      </div>

      {(proposal.reason ||
        proposal.notes ||
        proposal.status === 'approved') && (
        <dl className="mt-5 grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {proposal.status === 'approved' && (
            <>
              <Detail
                label="Montante aprovado"
                value={formatCurrency(proposal.approved_amount)}
              />
              <Detail
                label="Prazo aprovado"
                value={
                  proposal.approved_term_months
                    ? `${proposal.approved_term_months} meses`
                    : '—'
                }
              />
            </>
          )}

          {proposal.reason && (
            <Detail label="Motivo" value={proposal.reason} wide />
          )}

          {proposal.notes && (
            <Detail label="Notas do envio" value={proposal.notes} wide />
          )}
        </dl>
      )}

      {proposal.requests.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Documentos adicionais pedidos pelo banco
          </p>

          <ul className="mt-2 space-y-2">
            {proposal.requests.map((request) => {
              const complete =
                request.status === 'completed' ||
                request.receivedCount >= request.quantity_required;

              return (
                <li
                  key={request.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                >
                  <span className="text-gray-700">{request.label}</span>

                  <span
                    className={
                      complete
                        ? 'text-xs font-semibold text-emerald-700'
                        : 'text-xs font-semibold text-amber-700'
                    }
                  >
                    {request.receivedCount}/{request.quantity_required}{' '}
                    {complete ? 'recebido' : 'pendente'}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 text-xs text-gray-400">
            O cliente envia estes documentos pelo portal. Os ficheiros aparecem no separador Documentos.
          </p>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {panel === 'decision' && (
        <DecisionForm
          proposal={proposal}
          isPending={isPending}
          onCancel={() => setPanel(null)}
          onSubmit={(input) =>
            run(() =>
              decideProposalAction(processId, proposal.id, input),
            )
          }
        />
      )}

      {panel === 'documents' && (
        <DocumentsForm
          isPending={isPending}
          onCancel={() => setPanel(null)}
          onSubmit={(items) =>
            run(() =>
              requestProposalDocumentsAction(
                processId,
                proposal.id,
                items,
              ),
            )
          }
        />
      )}

      {panel === 'counter' && (
        <CounterForm
          creditType={creditType}
          isPending={isPending}
          onCancel={() => setPanel(null)}
          onSubmit={(input) =>
            run(() =>
              counterProposalAction(processId, proposal.id, input),
            )
          }
        />
      )}
    </section>
  );
}

/* =========================================================
   FORMULÁRIOS
========================================================= */

function DecisionForm({
  proposal,
  isPending,
  onCancel,
  onSubmit,
}: {
  proposal: ProposalData;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    status: ProposalStatus;
    reason: string;
    approvedAmount: string;
    approvedTermMonths: string;
  }) => void;
}) {
  const [status, setStatus] = useState<ProposalStatus>(
    proposal.status === 'in_analysis'
      ? 'approved'
      : (proposal.status as ProposalStatus),
  );
  const [reason, setReason] = useState(proposal.reason ?? '');
  const [approvedAmount, setApprovedAmount] = useState(
    proposal.approved_amount?.toString() ?? '',
  );
  const [approvedTermMonths, setApprovedTermMonths] = useState(
    proposal.approved_term_months?.toString() ?? '',
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ status, reason, approvedAmount, approvedTermMonths });
      }}
      className="mt-5 space-y-4 rounded-xl border border-gray-200 p-5"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-gray-700">
          Decisão
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ProposalStatus)
            }
            className={`${inputClassName} mt-2`}
          >
            <option value="approved">Aprovada</option>
            <option value="rejected">Recusada</option>
            <option value="in_analysis">Em análise</option>
          </select>
        </label>

        {status === 'approved' && (
          <>
            <label className="text-sm font-medium text-gray-700">
              Montante aprovado (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={approvedAmount}
                onChange={(event) => setApprovedAmount(event.target.value)}
                className={`${inputClassName} mt-2`}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Prazo aprovado (meses)
              <input
                type="number"
                min="1"
                step="1"
                value={approvedTermMonths}
                onChange={(event) =>
                  setApprovedTermMonths(event.target.value)
                }
                className={`${inputClassName} mt-2`}
              />
            </label>
          </>
        )}
      </div>

      <label className="block text-sm font-medium text-gray-700">
        Motivo
        {status === 'rejected' && <span className="text-red-500"> *</span>}
        <textarea
          rows={3}
          required={status === 'rejected'}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            status === 'rejected'
              ? 'Ex.: taxa de esforço elevada, incidentes bancários...'
              : 'Observações da decisão (opcional)'
          }
          className={`${inputClassName} mt-2 resize-y`}
        />
      </label>

      <FormButtons
        isPending={isPending}
        onCancel={onCancel}
        label="Guardar decisão"
      />
    </form>
  );
}

function DocumentsForm({
  isPending,
  onCancel,
  onSubmit,
}: {
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (
    items: { label: string; instructions: string; quantity: number }[],
  ) => void;
}) {
  const [items, setItems] = useState([
    { label: '', instructions: '', quantity: 1 },
  ]);

  function update(index: number, patch: Partial<(typeof items)[number]>) {
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(items);
      }}
      className="mt-5 space-y-4 rounded-xl border border-gray-200 p-5"
    >
      <p className="text-sm text-gray-500">
        Os documentos ficam pedidos no portal do cliente, associados a este banco.
      </p>

      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-3 md:grid-cols-[2fr_2fr_100px_auto]"
        >
          <input
            required
            aria-label="Documento"
            placeholder="Documento (ex.: Declaração da entidade patronal)"
            value={item.label}
            onChange={(event) => update(index, { label: event.target.value })}
            className={inputClassName}
          />

          <input
            aria-label="Instruções"
            placeholder="Instruções para o cliente (opcional)"
            value={item.instructions}
            onChange={(event) =>
              update(index, { instructions: event.target.value })
            }
            className={inputClassName}
          />

          <input
            type="number"
            min="1"
            max="12"
            aria-label="Quantidade"
            value={item.quantity}
            onChange={(event) =>
              update(index, { quantity: Number(event.target.value) })
            }
            className={inputClassName}
          />

          <button
            type="button"
            onClick={() => setItems(items.filter((_, i) => i !== index))}
            disabled={items.length === 1}
            className={secondaryButton}
            aria-label="Remover linha"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setItems([...items, { label: '', instructions: '', quantity: 1 }])
        }
        className="text-sm font-medium text-[#006571] hover:underline"
      >
        + Outro documento
      </button>

      <FormButtons
        isPending={isPending}
        onCancel={onCancel}
        label="Pedir ao cliente"
      />
    </form>
  );
}

function CounterForm({
  creditType,
  isPending,
  onCancel,
  onSubmit,
}: {
  creditType: string;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    vehicleMake: string;
    vehicleModel: string;
    vehicleVersion: string;
    vehicleYear: string;
    vehicleRegistration: string;
    vehiclePrice: string;
    dueDate: string;
    note: string;
  }) => void;
}) {
  const [values, setValues] = useState({
    vehicleMake: '',
    vehicleModel: '',
    vehicleVersion: '',
    vehicleYear: '',
    vehicleRegistration: '',
    vehiclePrice: '',
    dueDate: '',
    note: '',
  });

  function set(name: keyof typeof values, value: string) {
    setValues({ ...values, [name]: value });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className="mt-5 space-y-4 rounded-xl border border-gray-200 p-5"
    >
      {creditType === 'auto' ? (
        <>
          <p className="text-sm font-medium text-gray-700">
            Nova viatura{' '}
            <span className="font-normal text-gray-400">
              (substitui a atual; a anterior fica no histórico)
            </span>
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              placeholder="Marca"
              aria-label="Marca"
              value={values.vehicleMake}
              onChange={(event) => set('vehicleMake', event.target.value)}
              className={inputClassName}
            />
            <input
              placeholder="Modelo"
              aria-label="Modelo"
              value={values.vehicleModel}
              onChange={(event) => set('vehicleModel', event.target.value)}
              className={inputClassName}
            />
            <input
              placeholder="Versão"
              aria-label="Versão"
              value={values.vehicleVersion}
              onChange={(event) => set('vehicleVersion', event.target.value)}
              className={inputClassName}
            />
            <input
              type="number"
              min="1900"
              max="2100"
              placeholder="Ano"
              aria-label="Ano"
              value={values.vehicleYear}
              onChange={(event) => set('vehicleYear', event.target.value)}
              className={inputClassName}
            />
            <input
              placeholder="Matrícula"
              aria-label="Matrícula"
              value={values.vehicleRegistration}
              onChange={(event) =>
                set('vehicleRegistration', event.target.value)
              }
              className={inputClassName}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Preço (€)"
              aria-label="Preço"
              value={values.vehiclePrice}
              onChange={(event) => set('vehiclePrice', event.target.value)}
              className={inputClassName}
            />
          </div>

          <p className="text-xs text-gray-400">
            Deixa a marca vazia para criar só o lembrete, sem mudar a viatura.
          </p>
        </>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <label className="text-sm font-medium text-gray-700">
          Falar com o comercial até
          <input
            type="date"
            value={values.dueDate}
            onChange={(event) => set('dueDate', event.target.value)}
            className={`${inputClassName} mt-2`}
          />
        </label>

        <label className="text-sm font-medium text-gray-700">
          Nota para o comercial
          <input
            placeholder="Ex.: propor viatura até 15.000 €"
            value={values.note}
            onChange={(event) => set('note', event.target.value)}
            className={`${inputClassName} mt-2`}
          />
        </label>
      </div>

      <FormButtons
        isPending={isPending}
        onCancel={onCancel}
        label="Registar contraproposta"
      />
    </form>
  );
}

/* =========================================================
   AUXILIARES
========================================================= */

function FormButtons({
  isPending,
  onCancel,
  label,
}: {
  isPending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
      >
        Cancelar
      </button>

      <button type="submit" disabled={isPending} className={primaryButton}>
        {isPending ? 'A guardar...' : label}
      </button>
    </div>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
        {value}
      </dd>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

export function ProposalBadge({ status }: { status: string }) {
  const classes =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'rejected'
        ? 'bg-red-50 text-red-700'
        : 'bg-[#EAF5F6] text-[#006571]';

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {PROPOSAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}
