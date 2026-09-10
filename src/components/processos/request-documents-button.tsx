'use client';

import {
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';

import { requestDocumentsAction } from '@/app/(crm)/processos/[id]/request-documents-actions';

type DocumentType =
  | 'identity'
  | 'address_proof'
  | 'income_proof'
  | 'salary_receipt'
  | 'bank_statement'
  | 'irs'
  | 'tax_assessment'
  | 'iban_proof'
  | 'pension_proof'
  | 'vehicle_document'
  | 'vehicle_invoice'
  | 'other';

type DocumentOption = {
  type: DocumentType;
  label: string;
  description: string;
  allowQuantity?: boolean;
  defaultQuantity?: number;
};

type SelectedDocument = {
  selected: boolean;
  quantity: number;
};

const DOCUMENT_OPTIONS: DocumentOption[] = [
  {
    type: 'identity',
    label: 'Documento de identificação',
    description:
      'Cartão de Cidadão ou documento equivalente.',
  },
  {
    type: 'address_proof',
    label: 'Comprovativo de morada',
    description:
      'Documento recente com a morada do cliente.',
  },
  {
    type: 'salary_receipt',
    label: 'Recibos de vencimento',
    description:
      'Recibos de vencimento mais recentes.',
    allowQuantity: true,
    defaultQuantity: 3,
  },
  {
    type: 'iban_proof',
    label: 'Comprovativo de IBAN',
    description:
      'Documento bancário onde conste o titular e o IBAN.',
  },
  {
    type: 'bank_statement',
    label: 'Extratos bancários',
    description:
      'Extratos bancários dos meses solicitados.',
    allowQuantity: true,
    defaultQuantity: 3,
  },
  {
    type: 'irs',
    label: 'IRS',
    description:
      'Declaração de IRS mais recente.',
  },
  {
    type: 'tax_assessment',
    label: 'Nota de liquidação',
    description:
      'Nota de liquidação de IRS.',
  },
  {
    type: 'pension_proof',
    label: 'Comprovativo de pensão',
    description:
      'Comprovativo de reforma ou pensão.',
  },
  {
    type: 'vehicle_document',
    label: 'Documento da viatura',
    description:
      'DUA ou outro documento relativo à viatura.',
  },
  {
    type: 'vehicle_invoice',
    label: 'Fatura / nota de encomenda',
    description:
      'Fatura pró-forma ou nota de encomenda da viatura.',
  },
  {
    type: 'income_proof',
    label: 'Outro comprovativo de rendimento',
    description:
      'Outro documento comprovativo dos rendimentos.',
  },
  {
    type: 'other',
    label: 'Outro documento',
    description:
      'Documento adicional necessário ao processo.',
  },
];

export default function RequestDocumentsButton({
  processId,
}: {
  processId: string;
}) {
  const router = useRouter();

  const [open, setOpen] =
    useState(false);

  const [isPending, startTransition] =
    useTransition();

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [selected, setSelected] =
    useState<
      Partial<
        Record<
          DocumentType,
          SelectedDocument
        >
      >
    >({});

  const selectedCount = useMemo(
    () =>
      Object.values(selected).filter(
        (item) => item?.selected,
      ).length,
    [selected],
  );

  function reset() {
    setSelected({});
    setError(null);
    setSuccess(null);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setOpen(false);
    reset();
  }

  function toggleDocument(
    option: DocumentOption,
  ) {
    setError(null);

    setSelected((current) => {
      const existing =
        current[option.type];

      return {
        ...current,

        [option.type]: {
          selected:
            !existing?.selected,

          quantity:
            existing?.quantity ??
            option.defaultQuantity ??
            1,
        },
      };
    });
  }

  function changeQuantity(
    type: DocumentType,
    quantity: number,
  ) {
    setSelected((current) => ({
      ...current,

      [type]: {
        selected:
          current[type]?.selected ??
          true,

        quantity: Math.max(
          1,
          Math.min(12, quantity),
        ),
      },
    }));
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);

    const documents =
      DOCUMENT_OPTIONS.filter(
        (option) =>
          selected[option.type]
            ?.selected,
      ).map((option) => ({
        type: option.type,

        label: option.label,

        quantityRequired:
          selected[option.type]
            ?.quantity ??
          option.defaultQuantity ??
          1,

        instructions:
          option.description,
      }));

    if (!documents.length) {
      setError(
        'Seleciona pelo menos um documento.',
      );

      return;
    }

    startTransition(async () => {
      const result =
        await requestDocumentsAction(
          processId,
          documents,
        );

      if (!result.success) {
        setError(result.message);
        return;
      }

      setSuccess(
        result.created === 1
          ? '1 documento foi pedido ao cliente.'
          : `${result.created} documentos foram pedidos ao cliente.`,
      );

      router.refresh();

      window.setTimeout(() => {
        setOpen(false);
        reset();
      }, 700);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00545e]"
      >
        <PlusIcon />
        Pedir documentos
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={closeModal}
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
          />

          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-[#172126]">
                  Pedir documentação
                </h2>

                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Selecione os documentos que
                  o cliente deve enviar através
                  do portal.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="space-y-3">
                {DOCUMENT_OPTIONS.map(
                  (option) => {
                    const state =
                      selected[
                        option.type
                      ];

                    const checked =
                      state?.selected ??
                      false;

                    return (
                      <div
                        key={option.type}
                        className={[
                          'rounded-xl border transition',
                          checked
                            ? 'border-[#1693A0]/40 bg-[#F4FAFA]'
                            : 'border-gray-200 bg-white hover:border-gray-300',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleDocument(
                              option,
                            )
                          }
                          className="flex w-full items-start gap-4 p-4 text-left"
                        >
                          <span
                            className={[
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                              checked
                                ? 'border-[#006571] bg-[#006571] text-white'
                                : 'border-gray-300 bg-white',
                            ].join(
                              ' ',
                            )}
                          >
                            {checked && (
                              <CheckIcon />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-800">
                              {
                                option.label
                              }
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-gray-400">
                              {
                                option.description
                              }
                            </span>
                          </span>
                        </button>

                        {checked &&
                          option.allowQuantity && (
                            <div className="flex items-center justify-between gap-4 border-t border-[#1693A0]/10 px-4 py-3">
                              <div>
                                <p className="text-xs font-semibold text-gray-600">
                                  Quantidade
                                  necessária
                                </p>

                                <p className="mt-0.5 text-[11px] text-gray-400">
                                  Número de
                                  ficheiros que o
                                  cliente deve
                                  enviar.
                                </p>
                              </div>

                              <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    changeQuantity(
                                      option.type,
                                      (state
                                        ?.quantity ??
                                        option.defaultQuantity ??
                                        1) -
                                        1,
                                    )
                                  }
                                  className="flex h-9 w-9 items-center justify-center text-gray-500 transition hover:bg-gray-50"
                                >
                                  −
                                </button>

                                <div className="flex h-9 min-w-10 items-center justify-center border-x border-gray-200 px-2 text-sm font-semibold text-gray-800">
                                  {state
                                    ?.quantity ??
                                    option.defaultQuantity ??
                                    1}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    changeQuantity(
                                      option.type,
                                      (state
                                        ?.quantity ??
                                        option.defaultQuantity ??
                                        1) +
                                        1,
                                    )
                                  }
                                  className="flex h-9 w-9 items-center justify-center text-gray-500 transition hover:bg-gray-50"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  },
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-[#FAFBFB] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-400">
                {selectedCount === 0
                  ? 'Nenhum documento selecionado'
                  : selectedCount === 1
                    ? '1 documento selecionado'
                    : `${selectedCount} documentos selecionados`}
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={
                    handleSubmit
                  }
                  disabled={
                    isPending ||
                    selectedCount === 0
                  }
                  className="rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00545e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending
                    ? 'A adicionar...'
                    : 'Adicionar ao pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="m6 12 4 4 8-8" />
    </svg>
  );
}