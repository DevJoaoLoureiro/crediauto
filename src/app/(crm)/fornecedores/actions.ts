'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

function optionalString(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim();
  return value || null;
}

export async function createSupplierAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const name = String(formData.get('name') ?? '').trim();
  const nif = String(formData.get('nif') ?? '').replace(/\D/g, '');

  if (!name) {
    redirect('/fornecedores?error=missing-name');
  }

  if (nif && nif.length !== 9) {
    redirect('/fornecedores?error=invalid-nif');
  }

  const { error } = await supabase.from('suppliers').insert({
    name,
    nif: nif || null,
    email: optionalString(formData, 'email'),
    phone: optionalString(formData, 'phone'),
    city: optionalString(formData, 'city'),
    created_by: user.id,
  });

  if (error) {
    console.error('Erro ao criar fornecedor:', error);
    redirect('/fornecedores?error=create');
  }

  revalidatePath('/fornecedores');
  redirect('/fornecedores?created=1');
}

export async function setSupplierActiveAction(
  supplierId: string,
  active: boolean,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { error } = await supabase
    .from('suppliers')
    .update({ active })
    .eq('id', supplierId);

  if (error) {
    console.error('Erro ao atualizar fornecedor:', error);
  }

  revalidatePath('/fornecedores');
}
