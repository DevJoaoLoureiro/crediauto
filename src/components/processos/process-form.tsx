import Link from 'next/link';

import { createProcessAction } from '@/app/(crm)/processos/actions';

type ClientOption = {
  id: string;
  full_name: string;
  nif: string | null;
};

type ProcessFormProps = {
  clients: ClientOption[];
  selectedClientId?: string;
  error?: string;
};

export default function ProcessForm({
  clients,
  selectedClientId,
  error,
}: ProcessFormProps) {
  const errorMessage =
    error === 'missing-client'
      ? 'Seleciona o cliente deste processo.'
      : error === 'invalid-client'
        ? 'O cliente selecionado não é válido.'
        : error === 'invalid-amount'
          ? 'O montante solicitado deve ser superior a zero.'
          : error === 'invalid-down-payment'
            ? 'A entrada não pode ser negativa.'
            : error === 'invalid-term'
              ? 'O prazo deve ser superior a zero meses.'
              : error === 'create'
                ? 'Não foi possível criar o processo.'
                : null;

  return (
    <form action={createProcessAction} className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Cliente"
          description="Cliente associado ao processo de crédito."
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
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10"
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

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Financiamento"
          description="Condições pretendidas para o financiamento."
        />

        <div className="grid gap-5 md:grid-cols-3">
          <Field
            label="Montante solicitado"
            name="requested_amount"
            type="number"
            min="0"
            step="0.01"
            suffix="€"
          />

          <Field
            label="Entrada"
            name="down_payment"
            type="number"
            min="0"
            step="0.01"
            suffix="€"
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
              defaultValue=""
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10"
            >
              <option value="">Selecionar...</option>
              <option value="12">12 meses</option>
              <option value="24">24 meses</option>
              <option value="36">36 meses</option>
              <option value="48">48 meses</option>
              <option value="60">60 meses</option>
              <option value="72">72 meses</option>
              <option value="84">84 meses</option>
              <option value="96">96 meses</option>
              <option value="120">120 meses</option>
            </select>
          </div>
        </div>
      </section>

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
          />

          <Field
            label="Modelo"
            name="vehicle_model"
            placeholder="Ex.: Série 1"
          />

          <Field
            label="Versão"
            name="vehicle_version"
            placeholder="Ex.: 116d Pack M"
          />

          <Field
            label="Ano"
            name="vehicle_year"
            type="number"
            min="1900"
            max="2100"
            placeholder="2024"
          />

          <Field
            label="Matrícula"
            name="vehicle_registration"
            placeholder="AA-00-AA"
          />

          <Field
            label="Preço da viatura"
            name="vehicle_price"
            type="number"
            min="0"
            step="0.01"
            suffix="€"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Notas"
          description="Informação interna relevante para este processo."
        />

        <textarea
          name="notes"
          rows={5}
          placeholder="Observações sobre o processo..."
          className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10"
        />
      </section>

      <div className="flex justify-end gap-3">
        <Link
          href="/processos"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          className="rounded-xl bg-[#006571] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
        >
          Criar processo
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

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  suffix?: string;
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
          className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10 ${
            suffix ? 'pr-10' : ''
          }`}
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