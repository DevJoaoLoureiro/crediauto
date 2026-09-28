'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CREDIT_TYPE_LABELS, CREDIT_TYPES } from '@/lib/crm/labels';
import type {
  SupplierOption,
  TeamMemberOption,
} from '@/lib/crm/options';

type ClientOption = {
  id: string;
  full_name: string;
  nif: string | null;
};

export type ProcessFormValues = {
  credit_type: string;
  requested_amount: number | null;
  down_payment: number | null;
  term_months: number | null;

  supplier_id: string | null;
  commercial_id: string | null;
  assistant_id: string | null;
  administrative_id: string | null;

  vehicle_imported: boolean;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_version: string | null;
  vehicle_year: number | null;
  vehicle_registration: string | null;
  vehicle_price: number | null;

  notes: string | null;
};

type ProcessFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  mode: 'create' | 'edit';

  suppliers: SupplierOption[];
  team: TeamMemberOption[];

  /** Apenas ao criar: o cliente passa a 1.º titular. */
  clients?: ClientOption[];
  selectedClientId?: string;

  defaultValues?: Partial<ProcessFormValues>;
  cancelHref: string;
  error?: string;
};

const errorMessages: Record<string, string> = {
  'missing-client': 'Seleciona o cliente deste processo.',
  'invalid-client': 'O cliente selecionado não é válido.',
  'invalid-credit-type': 'O tipo de crédito não é válido.',
  'invalid-amount': 'O montante solicitado deve ser superior a zero.',
  'invalid-down-payment': 'A entrada não pode ser negativa.',
  'invalid-term': 'O prazo deve ser superior a zero meses.',
  create: 'Não foi possível criar o processo.',
  update: 'Não foi possível guardar as alterações.',
};

const TERM_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96, 120];

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10';

export default function ProcessForm({
  action,
  mode,
  suppliers,
  team,
  clients = [],
  selectedClientId,
  defaultValues = {},
  cancelHref,
  error,
}: ProcessFormProps) {
  const errorMessage = error ? errorMessages[error] ?? null : null;

  /*
   * A secção Viatura só existe no crédito auto.
   */
  const [creditType, setCreditType] = useState(
    defaultValues.credit_type ?? 'auto',
  );

  const termOptions =
    defaultValues.term_months &&
    !TERM_OPTIONS.includes(defaultValues.term_months)
      ? [...TERM_OPTIONS, defaultValues.term_months].sort((a, b) => a - b)
      : TERM_OPTIONS;

  return (
    <form action={action} className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {mode === 'create' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Cliente"
            description="1.º titular do processo. Outros titulares e avalistas adicionam-se depois, no processo."
          />

          <div className="max-w-2xl">
            <label
              htmlFor="client_id"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Cliente <span className="text-red-500">*</span>
            </label>

            <select
              id="client_id"
              name="client_id"
              required
              defaultValue={selectedClientId ?? ''}
              className={inputClassName}
            >
              <option value="">Selecionar cliente...</option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                  {client.nif ? ` — ${client.nif}` : ''}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-gray-400">
              Não encontras o cliente?{' '}
              <Link
                href="/clientes/novo"
                className="font-medium text-[#006571] hover:underline"
              >
                Criar novo cliente
              </Link>
            </p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Financiamento"
          description="Tipo de crédito e condições pretendidas."
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label
              htmlFor="credit_type"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Tipo de crédito <span className="text-red-500">*</span>
            </label>

            <select
              id="credit_type"
              name="credit_type"
              required
              value={creditType}
              onChange={(event) => setCreditType(event.target.value)}
              className={inputClassName}
            >
              {CREDIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CREDIT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Montante solicitado"
            name="requested_amount"
            type="number"
            min="0"
            step="0.01"
            suffix="€"
            defaultValue={defaultValues.requested_amount}
          />

          <Field
            label="Entrada"
            name="down_payment"
            type="number"
            min="0"
            step="0.01"
            suffix="€"
            defaultValue={defaultValues.down_payment}
          />

          <div>
            <label
              htmlFor="term_months"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Prazo
            </label>

            <select
              id="term_months"
              name="term_months"
              defaultValue={defaultValues.term_months ?? ''}
              className={inputClassName}
            >
              <option value="">Selecionar...</option>
              {termOptions.map((months) => (
                <option key={months} value={months}>
                  {months} meses
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Fornecedor e equipa"
          description="Fornecedor do bem e colaboradores responsáveis por este processo."
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Fornecedor do bem"
            name="supplier_id"
            defaultValue={defaultValues.supplier_id}
            options={suppliers.map((supplier) => ({
              value: supplier.id,
              label: supplier.name,
            }))}
            emptyHint={
              <>
                Sem fornecedores.{' '}
                <Link
                  href="/fornecedores"
                  className="font-medium text-[#006571] hover:underline"
                >
                  Adicionar
                </Link>
              </>
            }
          />

          <SelectField
            label="Comercial"
            name="commercial_id"
            defaultValue={defaultValues.commercial_id}
            options={team.map((member) => ({
              value: member.id,
              label: member.full_name,
            }))}
          />

          <SelectField
            label="Assistente"
            name="assistant_id"
            defaultValue={defaultValues.assistant_id}
            options={team.map((member) => ({
              value: member.id,
              label: member.full_name,
            }))}
          />

          <SelectField
            label="Administrativo F"
            name="administrative_id"
            defaultValue={defaultValues.administrative_id}
            options={team.map((member) => ({
              value: member.id,
              label: member.full_name,
            }))}
          />
        </div>
      </section>

      {creditType === 'auto' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Viatura"
            description="Dados da viatura associada ao financiamento."
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Marca"
              name="vehicle_make"
              placeholder="Ex.: BMW"
              defaultValue={defaultValues.vehicle_make}
            />

            <Field
              label="Modelo"
              name="vehicle_model"
              placeholder="Ex.: Série 1"
              defaultValue={defaultValues.vehicle_model}
            />

            <Field
              label="Versão"
              name="vehicle_version"
              placeholder="Ex.: 116d Pack M"
              defaultValue={defaultValues.vehicle_version}
            />

            <Field
              label="Ano"
              name="vehicle_year"
              type="number"
              min="1900"
              max="2100"
              placeholder="2024"
              defaultValue={defaultValues.vehicle_year}
            />

            <Field
              label="Matrícula"
              name="vehicle_registration"
              placeholder="AA-00-AA"
              defaultValue={defaultValues.vehicle_registration}
            />

            <Field
              label="Preço da viatura"
              name="vehicle_price"
              type="number"
              min="0"
              step="0.01"
              suffix="€"
              defaultValue={defaultValues.vehicle_price}
            />
          </div>

          <label className="mt-5 inline-flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 transition hover:bg-white">
            <input
              type="checkbox"
              name="vehicle_imported"
              defaultChecked={defaultValues.vehicle_imported ?? false}
              className="h-4 w-4 rounded border-gray-300 accent-[#006571]"
            />
            Viatura importada
          </label>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Notas"
          description="Informação interna relevante para este processo."
        />

        <textarea
          name="notes"
          rows={5}
          placeholder="Observações sobre o processo..."
          defaultValue={defaultValues.notes ?? ''}
          className={`${inputClassName} resize-y`}
        />
      </section>

      <div className="flex justify-end gap-3">
        <Link
          href={cancelHref}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          className="rounded-xl bg-[#006571] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
        >
          {mode === 'create' ? 'Criar processo' : 'Guardar alterações'}
        </button>
      </div>
    </form>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  emptyHint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  emptyHint?: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>

      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className={inputClassName}
      >
        <option value="">Sem atribuição</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {options.length === 0 && emptyHint && (
        <p className="mt-2 text-xs text-gray-400">{emptyHint}</p>
      )}
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  suffix?: string;
  defaultValue?: string | number | null;
};

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  min,
  max,
  step,
  suffix,
  defaultValue,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue ?? ''}
          className={`${inputClassName} ${suffix ? 'pr-10' : ''}`}
        />

        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
