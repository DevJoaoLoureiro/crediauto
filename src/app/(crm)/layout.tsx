import type {
  ReactNode,
} from 'react';

import {
  redirect,
} from 'next/navigation';

import Sidebar from '@/components/crm/sidebar';
import Header from '@/components/crm/header';

import {
  createClient,
} from '@/lib/supabase/server';

export default async function CrmLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase =
    await createClient();

  /*
   * =========================================
   * UTILIZADOR AUTENTICADO
   * =========================================
   */

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    redirect('/');
  }

  /*
   * =========================================
   * PERFIL DO UTILIZADOR
   * =========================================
   */

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select(`
      full_name,
      role
    `)
    .eq(
      'id',
      user.id,
    )
    .maybeSingle();

  if (
    profileError
  ) {
    console.error(
      'Erro ao carregar perfil do utilizador:',
      profileError,
    );
  }

  /*
   * Fallbacks para não partir o header
   * caso o profile esteja temporariamente
   * incompleto.
   */

  const fullName =
    profile?.full_name?.trim() ||
    user.email ||
    'Utilizador';

  const role =
    profile?.role ??
    'manager';

  return (
    <div className="min-h-screen bg-[#F6F8F9]">
      <Sidebar />

      <div className="min-h-screen lg:pl-[260px]">
        <Header
          fullName={
            fullName
          }
          role={
            role
          }
        />

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}