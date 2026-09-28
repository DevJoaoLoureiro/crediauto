import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type SupplierOption = {
  id: string;
  name: string;
};

export type TeamMemberOption = {
  id: string;
  full_name: string;
};

/*
 * Opções usadas nos formulários de processo:
 * fornecedores ativos e membros da equipa.
 */
export async function loadProcessFormOptions(
  supabase: SupabaseClient,
) {
  const [suppliersResult, teamResult] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('active', true)
      .order('name', { ascending: true }),

    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name', { ascending: true }),
  ]);

  if (suppliersResult.error) {
    console.error(
      'Erro ao carregar fornecedores:',
      suppliersResult.error,
    );
  }

  if (teamResult.error) {
    console.error(
      'Erro ao carregar equipa:',
      teamResult.error,
    );
  }

  return {
    suppliers: (suppliersResult.data ?? []) as SupplierOption[],
    team: (teamResult.data ?? []) as TeamMemberOption[],
  };
}
