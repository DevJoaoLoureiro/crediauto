'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export async function createClientAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const fullName = String(
    formData.get('full_name') ?? '',
  ).trim();

  const nif = String(
    formData.get('nif') ?? '',
  ).trim();

  const identificationNumber = String(
    formData.get('identification_number') ?? '',
  ).trim();

  const birthDate = String(
    formData.get('birth_date') ?? '',
  ).trim();

  const email = String(
    formData.get('email') ?? '',
  ).trim();

  const phone = String(
    formData.get('phone') ?? '',
  ).trim();

  const address = String(
    formData.get('address') ?? '',
  ).trim();

  const postalCode = String(
    formData.get('postal_code') ?? '',
  ).trim();

  const city = String(
    formData.get('city') ?? '',
  ).trim();

  const notes = String(
    formData.get('notes') ?? '',
  ).trim();

  if (!fullName) {
    redirect('/clientes/novo?error=missing-name');
  }

  if (nif && !/^\d{9}$/.test(nif)) {
    redirect('/clientes/novo?error=invalid-nif');
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      manager_id: user.id,
      full_name: fullName,
      nif: nif || null,
      identification_number:
        identificationNumber || null,
      birth_date: birthDate || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      postal_code: postalCode || null,
      city: city || null,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error(error);

    redirect('/clientes/novo?error=create');
  }

  revalidatePath('/clientes');

  redirect(`/clientes/${data.id}`);
}