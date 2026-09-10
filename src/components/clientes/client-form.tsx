import Link from 'next/link';

import { createClientAction } from '@/app/(crm)/clientes/actions';

type ClientFormProps = {
  error?: string;
};

export default function ClientForm({
  error,
}: ClientFormProps) {
  const errorMessage =
    error === 'missing-name'
      ? 'O nome do cliente é obrigatório.'
      : error === 'invalid-nif'
        ? 'O NIF deve ter exatamente 9 dígitos.'
        : error === 'create'
          ? 'Não foi possível criar o cliente.'
          : null;

  return (
    <form
      action={createClientAction}
      className="space-y-6"
    >
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="font-semibold text-gray-950">
            Dados pessoais
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Informação principal do cliente.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Nome completo"
            name="full_name"
            required
            autoComplete="name"
          />

          <Field
            label="NIF"
            name="nif"
            inputMode="numeric"
            maxLength={9}
          />

          <Field
            label="Número de identificação"
            name="identification_number"
          />

          <Field
            label="Data de nascimento"
            name="birth_date"
            type="date"
          />

          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
          />

          <Field
            label="Telefone"
            name="phone"
            type="tel"
            autoComplete="tel"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="font-semibold text-gray-950">
            Morada
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Informação de residência do cliente.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field
              label="Morada"
              name="address"
              autoComplete="street-address"
            />
          </div>

          <Field
            label="Código postal"
            name="postal_code"
            autoComplete="postal-code"
          />

          <Field
            label="Localidade"
            name="city"
            autoComplete="address-level2"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label
          htmlFor="notes"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Notas
        </label>

        <textarea
          id="notes"
          name="notes"
          rows={5}
          placeholder="Observações internas..."
          className="
            w-full
            resize-y
            rounded-xl
            border
            border-gray-200
            bg-gray-50
            px-4
            py-3
            text-sm
            text-gray-900
            outline-none
            transition
            placeholder:text-gray-400
            focus:border-[#1693A0]
            focus:bg-white
            focus:ring-4
            focus:ring-[#1693A0]/10
          "
        />
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/clientes"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          className="rounded-xl bg-[#006571] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00535d]"
        >
          Guardar cliente
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  inputMode?:
    | 'none'
    | 'text'
    | 'tel'
    | 'url'
    | 'email'
    | 'numeric'
    | 'decimal'
    | 'search';
  maxLength?: number;
  autoComplete?: string;
};

function Field({
  label,
  name,
  type = 'text',
  required,
  inputMode,
  maxLength,
  autoComplete,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="
          w-full
          rounded-xl
          border
          border-gray-200
          bg-gray-50
          px-4
          py-3
          text-sm
          text-gray-900
          outline-none
          transition
          placeholder:text-gray-400
          focus:border-[#1693A0]
          focus:bg-white
          focus:ring-4
          focus:ring-[#1693A0]/10
        "
      />
    </div>
  );
}