'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

import {
  generateClientPortalToken,
  hashClientPortalToken,
} from '@/lib/client-portal/tokens';

import {
  encryptPortalToken,
  decryptPortalToken,
} from '@/lib/client-portal/encryption';
import { ensureRgpdForAllParticipants } from '@/lib/rgpd/ensure-rgpd-state';

type GeneratePortalResult =
  | {
      success: true;
      url: string;
      expiresAt: string;
    }
  | {
      success: false;
      code:
        | 'NOT_AUTHENTICATED'
        | 'PROCESS_NOT_FOUND'
        | 'DATABASE_ERROR';
      message: string;
    };

type RevokePortalResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

/* =========================================================
   GERAR / RECUPERAR PORTAL
========================================================= */

export async function generateClientPortalLinkAction(
  processId: string,
): Promise<GeneratePortalResult> {
  const supabase =
    await createClient();

  /* =======================================================
     AUTENTICAÇÃO
  ======================================================= */

  const {
    data: { user },
    error: authError,
  } =
    await supabase.auth.getUser();

  if (
    authError ||
    !user
  ) {
    return {
      success: false,
      code: 'NOT_AUTHENTICATED',
      message:
        'Sessão inválida.',
    };
  }

  /* =======================================================
     VALIDAR PROCESSO POR RLS
  ======================================================= */

  const {
    data: creditProcess,
    error: processError,
  } = await supabase
    .from('credit_processes')
    .select(`
      id,
      client_id,
      reference
    `)
    .eq('id', processId)
    .maybeSingle();

  if (processError) {
    console.error(
      'Erro ao consultar processo:',
      processError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível consultar o processo.',
    };
  }

  if (!creditProcess) {
    return {
      success: false,
      code: 'PROCESS_NOT_FOUND',
      message:
        'Processo não encontrado.',
    };
  }

  const admin =
    createAdminClient();

  /* =======================================================
     GARANTIR RGPD DE TODOS OS INTERVENIENTES

     Esta função é idempotente.
  ======================================================= */

  try {
    await ensureRgpdForAllParticipants(
      admin,
      creditProcess.id,
      creditProcess.client_id,
      user.id,
    );
  } catch (error) {
    console.error(
      'Erro ao preparar RGPD:',
      error,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível preparar a documentação do portal.',
    };
  }

  /* =======================================================
     PROCURAR PORTAL ATIVO

     SE EXISTE:
     DEVOLVE O MESMO PORTAL.
     NÃO CRIA OUTRO.
  ======================================================= */

  const now =
    new Date().toISOString();

  const {
    data: activePortal,
    error: activePortalError,
  } = await admin
    .from('client_portal_tokens')
    .select(`
      id,
      token_ciphertext,
      expires_at,
      created_at
    `)
    .eq(
      'process_id',
      creditProcess.id,
    )
    .is(
      'revoked_at',
      null,
    )
    .gt(
      'expires_at',
      now,
    )
    .order(
      'created_at',
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (activePortalError) {
    console.error(
      'Erro ao verificar portal ativo:',
      activePortalError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível verificar o portal.',
    };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'NEXT_PUBLIC_APP_URL não está configurada.',
    };
  }

  if (activePortal) {
    if (
      !activePortal.token_ciphertext
    ) {
      return {
        success: false,
        code: 'DATABASE_ERROR',
        message:
          'Este portal foi criado com a versão antiga. Revogue-o uma vez e crie um novo portal.',
      };
    }

    try {
      const existingToken =
        decryptPortalToken(
          activePortal.token_ciphertext,
        );

      return {
        success: true,

        url:
          `${baseUrl}/documentos-cliente/${existingToken}`,

        expiresAt:
          activePortal.expires_at,
      };
    } catch (error) {
      console.error(
        'Erro ao decifrar token do portal:',
        error,
      );

      return {
        success: false,
        code: 'DATABASE_ERROR',
        message:
          'Não foi possível recuperar o link do portal.',
      };
    }
  }

  /* =======================================================
     NÃO EXISTE PORTAL ATIVO

     CRIAR UM ÚNICO PORTAL.
  ======================================================= */

  const rawToken =
    generateClientPortalToken();

  const tokenHash =
    hashClientPortalToken(
      rawToken,
    );

  const tokenCiphertext =
    encryptPortalToken(
      rawToken,
    );

  const expiresAt =
    new Date();

  expiresAt.setDate(
    expiresAt.getDate() + 30,
  );

  const {
    error: insertPortalError,
  } = await admin
    .from('client_portal_tokens')
    .insert({
      process_id:
        creditProcess.id,

      token_hash:
        tokenHash,

      token_ciphertext:
        tokenCiphertext,

      expires_at:
        expiresAt.toISOString(),

      created_by:
        user.id,
    });

  if (insertPortalError) {
    console.error(
      'Erro ao criar portal:',
      insertPortalError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível criar o portal do cliente.',
    };
  }

  return {
    success: true,

    url:
      `${baseUrl}/documentos-cliente/${rawToken}`,

    expiresAt:
      expiresAt.toISOString(),
  };
}

/* =========================================================
   REVOGAR PORTAL

   Isto é explícito.
   Só acontece quando o gestor carrega em Revogar.
========================================================= */

export async function revokeClientPortalAction(
  processId: string,
): Promise<RevokePortalResult> {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: authError,
  } =
    await supabase.auth.getUser();

  if (
    authError ||
    !user
  ) {
    return {
      success: false,
      message:
        'Sessão inválida.',
    };
  }

  /* =======================================================
     VALIDAR PROCESSO POR RLS
  ======================================================= */

  const {
    data: creditProcess,
    error: processError,
  } = await supabase
    .from('credit_processes')
    .select('id')
    .eq('id', processId)
    .maybeSingle();

  if (
    processError ||
    !creditProcess
  ) {
    return {
      success: false,
      message:
        'Processo não encontrado.',
    };
  }

  const admin =
    createAdminClient();

  const {
    error: revokeError,
  } = await admin
    .from('client_portal_tokens')
    .update({
      revoked_at:
        new Date().toISOString(),
    })
    .eq(
      'process_id',
      creditProcess.id,
    )
    .is(
      'revoked_at',
      null,
    );

  if (revokeError) {
    console.error(
      'Erro ao revogar portal:',
      revokeError,
    );

    return {
      success: false,
      message:
        'Não foi possível revogar o portal.',
    };
  }

  return {
    success: true,
  };
}