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

type AdminClient = ReturnType<
  typeof createAdminClient
>;

/* =========================================================
   GARANTIR ESTADO DO RGPD

   Regra:
   1. Signed existente -> reutiliza
   2. Pending existente -> reutiliza
   3. Nenhum -> cria UM pending

   Nunca cria outro RGPD só porque o portal é aberto.
========================================================= */

async function ensureRgpdState(
  admin: AdminClient,
  processId: string,
  clientId: string,
  userId: string,
) {
  /* =======================================================
     DOCUMENTOS RGPD EXISTENTES
  ======================================================= */

  const {
    data: rgpdDocuments,
    error: rgpdDocumentsError,
  } = await admin
    .from('documents')
    .select(`
      id,
      request_id,
      status,
      file_name,
      storage_path,
      signed_at,
      created_at
    `)
    .eq('process_id', processId)
    .eq('type', 'rgpd')
    .order('created_at', {
      ascending: false,
    });

  if (rgpdDocumentsError) {
    throw new Error(
      `Erro ao consultar RGPD: ${rgpdDocumentsError.message}`,
    );
  }

  const signedRgpd =
    rgpdDocuments?.find(
      (document) =>
        document.status === 'signed',
    ) ?? null;

  const pendingRgpd =
    rgpdDocuments?.find(
      (document) =>
        document.status === 'pending',
    ) ?? null;

  /* =======================================================
     PEDIDO RGPD EXISTENTE
  ======================================================= */

  const {
    data: existingRequests,
    error: requestError,
  } = await admin
    .from('document_requests')
    .select(`
      id,
      status,
      created_at
    `)
    .eq('process_id', processId)
    .eq('type', 'rgpd')
    .neq('status', 'cancelled')
    .order('created_at', {
      ascending: true,
    });

  if (requestError) {
    throw new Error(
      `Erro ao consultar pedido RGPD: ${requestError.message}`,
    );
  }

  /*
   * Usamos o pedido mais antigo ativo.
   * Num processo limpo só deverá existir um.
   */
  let rgpdRequest =
    existingRequests?.[0] ?? null;

  /* =======================================================
     CRIAR PEDIDO RGPD SE NÃO EXISTIR
  ======================================================= */

  if (!rgpdRequest) {
    const {
      data: newRequest,
      error: createRequestError,
    } = await admin
      .from('document_requests')
      .insert({
        process_id: processId,
        client_id: clientId,

        type: 'rgpd',

        label: 'RGPD',

        instructions:
          'Leia e assine o documento de proteção de dados.',

        quantity_required: 1,

        status: signedRgpd
          ? 'completed'
          : 'pending',

        created_by: userId,
      })
      .select(`
        id,
        status,
        created_at
      `)
      .single();

    if (
      createRequestError ||
      !newRequest
    ) {
      throw new Error(
        `Erro ao criar pedido RGPD: ${
          createRequestError?.message ??
          'resultado vazio'
        }`,
      );
    }

    rgpdRequest = newRequest;
  }

  /* =======================================================
     RGPD JÁ ASSINADO

     TERMINA AQUI.
     NÃO CRIA PENDING.
  ======================================================= */

  if (signedRgpd) {
    if (
      signedRgpd.request_id !==
      rgpdRequest.id
    ) {
      const {
        error: associationError,
      } = await admin
        .from('documents')
        .update({
          request_id:
            rgpdRequest.id,
        })
        .eq(
          'id',
          signedRgpd.id,
        );

      if (associationError) {
        throw new Error(
          `Erro ao associar RGPD assinado: ${associationError.message}`,
        );
      }
    }

    if (
      rgpdRequest.status !==
      'completed'
    ) {
      const {
        error: completeError,
      } = await admin
        .from('document_requests')
        .update({
          status: 'completed',
        })
        .eq(
          'id',
          rgpdRequest.id,
        );

      if (completeError) {
        throw new Error(
          `Erro ao concluir pedido RGPD: ${completeError.message}`,
        );
      }
    }

    /*
     * Se por lixo antigo existir também algum pending,
     * NÃO criamos outro.
     *
     * Não apagamos automaticamente aqui para não destruir
     * dados silenciosamente.
     */
    return {
      requestId:
        rgpdRequest.id,
      documentId:
        signedRgpd.id,
      signed: true,
    };
  }

  /* =======================================================
     EXISTE RGPD PENDENTE

     REUTILIZAR.
  ======================================================= */

  if (pendingRgpd) {
    if (
      pendingRgpd.request_id !==
      rgpdRequest.id
    ) {
      const {
        error: associationError,
      } = await admin
        .from('documents')
        .update({
          request_id:
            rgpdRequest.id,
        })
        .eq(
          'id',
          pendingRgpd.id,
        );

      if (associationError) {
        throw new Error(
          `Erro ao associar RGPD pendente: ${associationError.message}`,
        );
      }
    }

    if (
      rgpdRequest.status !==
      'pending'
    ) {
      const {
        error: pendingRequestError,
      } = await admin
        .from('document_requests')
        .update({
          status: 'pending',
        })
        .eq(
          'id',
          rgpdRequest.id,
        );

      if (pendingRequestError) {
        throw new Error(
          `Erro ao atualizar pedido RGPD: ${pendingRequestError.message}`,
        );
      }
    }

    return {
      requestId:
        rgpdRequest.id,
      documentId:
        pendingRgpd.id,
      signed: false,
    };
  }

  /* =======================================================
     NÃO EXISTE DOCUMENTO RGPD

     SÓ AQUI CRIAMOS UM.
  ======================================================= */

  const {
    data: newDocument,
    error: createDocumentError,
  } = await admin
    .from('documents')
    .insert({
      process_id: processId,
      client_id: clientId,

      request_id:
        rgpdRequest.id,

      type: 'rgpd',
      status: 'pending',

      /*
       * Não existe ficheiro ainda.
       */
      file_name: null,
      storage_path: null,
      mime_type: null,
      file_size: null,
    })
    .select('id')
    .single();

  if (
    createDocumentError ||
    !newDocument
  ) {
    throw new Error(
      `Erro ao criar documento RGPD: ${
        createDocumentError?.message ??
        'resultado vazio'
      }`,
    );
  }

  return {
    requestId:
      rgpdRequest.id,
    documentId:
      newDocument.id,
    signed: false,
  };
}

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
     GARANTIR RGPD

     Esta função é idempotente.
  ======================================================= */

  try {
    await ensureRgpdState(
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