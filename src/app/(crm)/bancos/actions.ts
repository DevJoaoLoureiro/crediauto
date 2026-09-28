'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function createBankAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const name = String(formData.get('name') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!name) {
    redirect('/bancos?error=missing-name');
  }

  const { error } = await supabase.from('banks').insert({
    name,
    notes: notes || null,
    created_by: user.id,
  });

  if (error) {
    console.error('Erro ao criar banco:', error);

    redirect(
      `/bancos?error=${error.code === '23505' ? 'duplicate' : 'create'}`,
    );
  }

  revalidatePath('/bancos');
  redirect('/bancos?created=1');
}

export async function setBankActiveAction(
  bankId: string,
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
    .from('banks')
    .update({ active })
    .eq('id', bankId);

  if (error) {
    console.error('Erro ao atualizar banco:', error);
  }

  revalidatePath('/bancos');
}
