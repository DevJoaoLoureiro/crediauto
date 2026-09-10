'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

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

function generateProcessReference() {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString('hex').toUpperCase();

  return `CA-${year}-${suffix}`;
}

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

  const requestedAmount = optionalNumber(formData, 'requested_amount');
  const downPayment = optionalNumber(formData, 'down_payment');
  const termMonths = optionalInteger(formData, 'term_months');

  const vehicleYear = optionalInteger(formData, 'vehicle_year');
  const vehiclePrice = optionalNumber(formData, 'vehicle_price');

  if (requestedAmount !== null && requestedAmount <= 0) {
    redirect(
      `/processos/novo?client=${clientId}&error=invalid-amount`,
    );
  }

  if (downPayment !== null && downPayment < 0) {
    redirect(
      `/processos/novo?client=${clientId}&error=invalid-down-payment`,
    );
  }

  if (termMonths !== null && termMonths <= 0) {
    redirect(
      `/processos/novo?client=${clientId}&error=invalid-term`,
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

  const reference = generateProcessReference();

  const { data: process, error } = await supabase
    .from('credit_processes')
    .insert({
      reference,
      client_id: clientId,
      manager_id: user.id,

      status: 'new',

      requested_amount: requestedAmount,
      down_payment: downPayment,
      term_months: termMonths,

      vehicle_make: optionalString(formData, 'vehicle_make'),
      vehicle_model: optionalString(formData, 'vehicle_model'),
      vehicle_version: optionalString(formData, 'vehicle_version'),
      vehicle_year: vehicleYear,
      vehicle_registration: optionalString(
        formData,
        'vehicle_registration',
      ),
      vehicle_price: vehiclePrice,

      notes: optionalString(formData, 'notes'),
    })
    .select('id')
    .single();

  if (error || !process) {
    console.error('Erro ao criar processo:', error);

    redirect(
      `/processos/novo?client=${clientId}&error=create`,
    );
  }

  revalidatePath('/processos');
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath('/dashboard');

  redirect(`/processos/${process.id}`);
}