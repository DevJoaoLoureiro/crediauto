'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { logProcessEvent } from '@/lib/crm/events';
import {
  CREDIT_TYPES,
  type CreditType,
} from '@/lib/crm/labels';

function optionalString(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim();
  return value || null;
}

function optionalNumber(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim();

  if (!value) {
    return null;
  }

  const normalized = value.replace(',', '.');
  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function optionalInteger(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim();

  if (!value) {
    return null;
  }

  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) ? number : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalUuid(formData: FormData, name: string) {
  const value = optionalString(formData, name);

  return value && UUID_PATTERN.test(value) ? value : null;
}

function generateProcessReference() {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString('hex').toUpperCase();

  return `CA-${year}-${suffix}`;
}

/*
 * =========================================================
 * CAMPOS COMUNS A CRIAR E EDITAR
 * =========================================================
 */

type ProcessFieldsResult =
  | {
      error: null;
      fields: Record<string, unknown>;
    }
  | {
      error: string;
      fields: null;
    };

function parseProcessFields(formData: FormData): ProcessFieldsResult {
  const requestedAmount = optionalNumber(formData, 'requested_amount');
  const downPayment = optionalNumber(formData, 'down_payment');
  const termMonths = optionalInteger(formData, 'term_months');

  const creditType = String(formData.get('credit_type') ?? 'auto');

  if (!CREDIT_TYPES.includes(creditType as CreditType)) {
    return { error: 'invalid-credit-type', fields: null };
  }

  if (requestedAmount !== null && requestedAmount <= 0) {
    return { error: 'invalid-amount', fields: null };
  }

  if (downPayment !== null && downPayment < 0) {
    return { error: 'invalid-down-payment', fields: null };
  }

  if (termMonths !== null && termMonths <= 0) {
    return { error: 'invalid-term', fields: null };
  }

  /*
   * Os dados da viatura só se aplicam ao crédito auto.
   * Ao mudar para outro tipo, ficam vazios.
   */
  const isAuto = creditType === 'auto';

  const vehicleFields = {
    vehicle_imported: isAuto && formData.get('vehicle_imported') === 'on',
    vehicle_make: isAuto ? optionalString(formData, 'vehicle_make') : null,
    vehicle_model: isAuto ? optionalString(formData, 'vehicle_model') : null,
    vehicle_version: isAuto
      ? optionalString(formData, 'vehicle_version')
      : null,
    vehicle_year: isAuto ? optionalInteger(formData, 'vehicle_year') : null,
    vehicle_registration: isAuto
      ? optionalString(formData, 'vehicle_registration')
      : null,
    vehicle_price: isAuto ? optionalNumber(formData, 'vehicle_price') : null,
  };

  return {
    error: null,
    fields: {
      credit_type: creditType,

      requested_amount: requestedAmount,
      down_payment: downPayment,
      term_months: termMonths,

      supplier_id: optionalUuid(formData, 'supplier_id'),
      commercial_id: optionalUuid(formData, 'commercial_id'),
      assistant_id: optionalUuid(formData, 'assistant_id'),
      administrative_id: optionalUuid(formData, 'administrative_id'),

      ...vehicleFields,

      notes: optionalString(formData, 'notes'),
    },
  };
}

/*
 * =========================================================
 * CRIAR PROCESSO
 * =========================================================
 */

export async function createProcessAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const clientId = String(formData.get('client_id') ?? '').trim();

  if (!clientId) {
    redirect('/processos/novo?error=missing-client');
  }

  const parsed = parseProcessFields(formData);

  if (parsed.error !== null) {
    redirect(
      `/processos/novo?client=${clientId}&error=${parsed.error}`,
    );
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single();

  if (!client) {
    redirect('/processos/novo?error=invalid-client');
  }

  const { data: process, error } = await supabase
    .from('credit_processes')
    .insert({
      reference: generateProcessReference(),
      client_id: clientId,
      manager_id: user.id,

      status: 'new',

      ...parsed.fields,
    })
    .select('id')
    .single();

  if (error || !process) {
    console.error('Erro ao criar processo:', error);

    redirect(
      `/processos/novo?client=${clientId}&error=create`,
    );
  }

  /*
   * O cliente escolhido é o 1.º titular do processo.
   */
  const { error: participantError } = await supabase
    .from('process_participants')
    .insert({
      process_id: process.id,
      client_id: clientId,
      role: 'primary_holder',
      created_by: user.id,
    });

  if (participantError) {
    console.error(
      'Erro ao registar 1.º titular:',
      participantError,
    );
  }

  await logProcessEvent(supabase, {
    processId: process.id,
    type: 'process_created',
    createdBy: user.id,
  });

  revalidatePath('/processos');
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath('/dashboard');

  redirect(`/processos/${process.id}`);
}

/*
 * =========================================================
 * EDITAR PROCESSO
 *
 * O 1.º titular não muda aqui; gere-se nos intervenientes.
 * =========================================================
 */

export async function updateProcessAction(
  processId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const parsed = parseProcessFields(formData);

  if (parsed.error !== null) {
    redirect(
      `/processos/${processId}/editar?error=${parsed.error}`,
    );
  }

  const { data: updated, error } = await supabase
    .from('credit_processes')
    .update(parsed.fields)
    .eq('id', processId)
    .select('id')
    .maybeSingle();

  if (error || !updated) {
    console.error('Erro ao atualizar processo:', error);

    redirect(`/processos/${processId}/editar?error=update`);
  }

  await logProcessEvent(supabase, {
    processId,
    type: 'process_updated',
    createdBy: user.id,
  });

  revalidatePath('/processos');
  revalidatePath(`/processos/${processId}`);
  revalidatePath('/dashboard');

  redirect(`/processos/${processId}`);
}
