'use client';

import { useState, useTransition } from 'react';

import {
  setContractResolvedAction,
  setFundingStatusAction,
  setRegistrationVerifiedAction,
} from '@/app/(crm)/processos/[id]/stage-actions';
import {
  FUNDING_STATUS_LABELS,
  FUNDING_STATUSES,
  type FundingStatus,
} from '@/lib/crm/labels';
import { daysBetweenIsoDates } from '@/lib/format';

const inputClassName =
  'rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none transition focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10 disabled:opacity-60';

function useStageAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setError(null);

    startTransition(async () => {
      const result = await action();

      if (!result.success) {
        setError(result.message ?? 'Ocorreu um erro.');
      }
    });
  }

  return { isPending, error, run };
}

/* =========================================================
   CHECKBOX "RESOLVIDO" — contrato assinado entregue
========================================================= */

export function ContractResolvedCheckbox({
  processId,
  resolved,
  disabled = false,
  label = 'Resolvido',
}: {
  processId: string;
  resolved: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const { isPending, error, run } = useStageAction();

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={resolved}
          disabled={disabled || isPending}
          onChange={() => {
            if (
              resolved &&
              !window.confirm(
                'Reabrir o contrato? O processo volta à fase de assinatura do contrato.',
              )
            ) {
              return;
            }

            run(() => setContractResolvedAction(processId, !resolved));
          }}
          className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#006571] disabled:cursor-not-allowed"
        />
        {isPending ? 'A guardar...' : label}
      </label>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* =========================================================
   RESULTADO DO FINANCIAMENTO
========================================================= */

export function FundingStatusSelect({
  processId,
  value,
  disabled = false,
}: {
  processId: string;
  value: string | null;
  disabled?: boolean;
}) {
  const { isPending, error, run } = useStageAction();

  return (
    <div>
      <select
        aria-label="Resultado do financiamento"
        value={value ?? ''}
        disabled={disabled || isPending}
        onChange={(event) =>
          run(() =>
            setFundingStatusAction(
              processId,
              event.target.value as FundingStatus,
            ),
          )
        }
        className={inputClassName}
      >
        {!value && <option value="">—</option>}
        {FUNDING_STATUSES.map((status) => (
          <option key={status} value={status}>
            {FUNDING_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* =========================================================
   AVERBAMENTO VERIFICADO
========================================================= */

export function RegistrationVerifyForm({
  processId,
  verifiedOn,
  today,
}: {
  processId: string;
  verifiedOn: string | null;
  today: string;
}) {
  const { isPending, error, run } = useStageAction();
  const [date, setDate] = useState(verifiedOn ?? today);

  if (verifiedOn) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-emerald-700">
          ✓ Verificado
        </span>

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              window.confirm(
                'Anular a verificação do averbamento? O processo volta à fase de averbamento.',
              )
            ) {
              run(() => setRegistrationVerifiedAction(processId, ''));
            }
          }}
          className="text-xs font-medium text-gray-500 hover:text-red-600 hover:underline"
        >
          Anular
        </button>

        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => setRegistrationVerifiedAction(processId, date));
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="date"
        required
        max={today}
        value={date}
        onChange={(event) => setDate(event.target.value)}
        aria-label="Data de verificação do averbamento"
        className={inputClassName}
      />

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[#006571] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#00535d] disabled:opacity-60"
      >
        {isPending ? 'A guardar...' : 'Verificado'}
      </button>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

/* =========================================================
   INDICADOR DE PRAZO
========================================================= */

export function DeadlineBadge({
  deadline,
  today,
}: {
  deadline: string | null;
  today: string;
}) {
  if (!deadline) {
    return <span className="text-xs text-gray-400">Sem prazo</span>;
  }

  const days = daysBetweenIsoDates(today, deadline);

  const { text, classes } =
    days < 0
      ? {
          text: `Atrasado ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`,
          classes: 'bg-red-50 text-red-700',
        }
      : days === 0
        ? { text: 'Termina hoje', classes: 'bg-amber-50 text-amber-700' }
        : days <= 3
          ? {
              text: `${days} ${days === 1 ? 'dia' : 'dias'}`,
              classes: 'bg-amber-50 text-amber-700',
            }
          : {
              text: `${days} dias`,
              classes: 'bg-[#EAF5F6] text-[#006571]',
            };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${classes}`}
    >
      {text}
    </span>
  );
}
