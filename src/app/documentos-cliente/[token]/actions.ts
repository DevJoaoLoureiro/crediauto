'use server';

import {
  createHash,
  randomBytes,
} from 'crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import { hashClientPortalToken } from '@/lib/client-portal/tokens';

type StartRgpdResult =
  | {
      success: true;
      url: string;
    }
  | {
      success: false;
      code:
        | 'INVALID_PORTAL'
        | 'PORTAL_EXPIRED'
        | 'RGPD_ALREADY_SIGNED'
        | 'DATABASE_ERROR';
      message: string;
    };

/* =========================================================
   HELPERS DO TOKEN DE ASSINATURA
========================================================= */

function generateSignatureToken() {
  return randomBytes(32).toString(
    'base64url',
  );
}

function hashSignatureToken(
  token: string,
) {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

/* =========================================================
   INICIAR RGPD PELO PORTAL
========================================================= */

export async function startRgpdFromPortalAction(
  portalToken: string,
): Promise<StartRgpdResult> {
  if (
    !portalToken ||
    portalToken.length < 20
  ) {
    return {
      success: false,
      code: 'INVALID_PORTAL',
      message:
        'O acesso ao portal é inválido.',
    };
  }

  const admin = createAdminClient();

  /* =======================================================
     VALIDAR PORTAL
  ======================================================= */

  const portalTokenHash =
    hashClientPortalToken(
      portalToken,
    );

  const {
    data: portal,
    error: portalError,
  } = await admin
    .from('client_portal_tokens')
    .select(`
      id,
      process_id,
      expires_at,
      revoked_at
    `)
    .eq(
      'token_hash',
      portalTokenHash,
    )
    .maybeSingle();

  if (
    portalError ||
    !portal
  ) {
    if (portalError) {
      console.error(
        'Erro ao validar portal:',
        portalError,
      );
    }

    return {
      success: false,
      code: 'INVALID_PORTAL',
      message:
        'O acesso ao portal é inválido.',
    };
  }

  if (portal.revoked_at) {
    return {
      success: false,
      code: 'INVALID_PORTAL',
      message:
        'Este acesso ao portal foi revogado.',
    };
  }

  if (
    new Date(
      portal.expires_at,
    ).getTime() <= Date.now()
  ) {
    return {
      success: false,
      code: 'PORTAL_EXPIRED',
      message:
        'Este acesso ao portal expirou.',
    };
  }

  /* =======================================================
     CARREGAR PROCESSO
  ======================================================= */

  const {
    data: creditProcess,
    error: processError,
  } = await admin
    .from('credit_processes')
    .select(`
      id,
      client_id
    `)
    .eq('id', portal.process_id)
    .maybeSingle();

  if (
    processError ||
    !creditProcess
  ) {
    console.error(
      'Erro ao carregar processo do portal:',
      processError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível carregar o processo.',
    };
  }

  /* =======================================================
     1º — VERIFICAR SE O RGPD JÁ ESTÁ ASSINADO

     Se estiver:
     TERMINA.

     Nunca criar novo RGPD.
  ======================================================= */

  const {
    data: signedRgpd,
    error: signedRgpdError,
  } = await admin
    .from('documents')
    .select(`
      id,
      request_id,
      status,
      storage_path,
      signed_at
    `)
    .eq(
      'process_id',
      portal.process_id,
    )
    .eq('type', 'rgpd')
    .eq('status', 'signed')
    .order('created_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (signedRgpdError) {
    console.error(
      'Erro ao procurar RGPD assinado:',
      signedRgpdError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível verificar o RGPD.',
    };
  }

  if (signedRgpd) {
    /*
     * Aproveitamos para garantir que o pedido
     * lógico fica completed.
     */
    if (signedRgpd.request_id) {
      const {
        error: completeError,
      } = await admin
        .from('document_requests')
        .update({
          status: 'completed',
        })
        .eq(
          'id',
          signedRgpd.request_id,
        );

      if (completeError) {
        console.error(
          'Erro ao concluir pedido RGPD:',
          completeError,
        );
      }
    }

    return {
      success: false,
      code: 'RGPD_ALREADY_SIGNED',
      message:
        'O RGPD deste processo já se encontra assinado.',
    };
  }

  /* =======================================================
     PROCURAR / CRIAR DOCUMENT_REQUEST RGPD
  ======================================================= */

  const {
    data: existingRequest,
    error: requestError,
  } = await admin
    .from('document_requests')
    .select(`
      id,
      status
    `)
    .eq(
      'process_id',
      portal.process_id,
    )
    .eq('type', 'rgpd')
    .neq('status', 'cancelled')
    .order('created_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (requestError) {
    console.error(
      'Erro ao procurar pedido RGPD:',
      requestError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível preparar o RGPD.',
    };
  }

  let rgpdRequest =
    existingRequest;

  if (!rgpdRequest) {
    const {
      data: newRequest,
      error: createRequestError,
    } = await admin
      .from('document_requests')
      .insert({
        process_id:
          creditProcess.id,

        client_id:
          creditProcess.client_id,

        type: 'rgpd',

        label: 'RGPD',

        instructions:
          'Leia e assine o documento de proteção de dados.',

        quantity_required: 1,

        status: 'pending',
      })
      .select(`
        id,
        status
      `)
      .single();

    if (
      createRequestError ||
      !newRequest
    ) {
      console.error(
        'Erro ao criar pedido RGPD:',
        createRequestError,
      );

      return {
        success: false,
        code: 'DATABASE_ERROR',
        message:
          'Não foi possível preparar o RGPD.',
      };
    }

    rgpdRequest = newRequest;
  }

  /* =======================================================
     PROCURAR RGPD PENDENTE

     Reutilizamos SEMPRE o existente.
  ======================================================= */

  const {
    data: pendingRgpd,
    error: pendingRgpdError,
  } = await admin
    .from('documents')
    .select(`
      id,
      request_id,
      status
    `)
    .eq(
      'process_id',
      portal.process_id,
    )
    .eq('type', 'rgpd')
    .eq('status', 'pending')
    .order('created_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (pendingRgpdError) {
    console.error(
      'Erro ao procurar RGPD pendente:',
      pendingRgpdError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível preparar o documento RGPD.',
    };
  }

  let rgpdDocumentId: string;

  /* =======================================================
     JÁ EXISTE PENDING
  ======================================================= */

  if (pendingRgpd) {
    rgpdDocumentId =
      pendingRgpd.id;

    if (
      pendingRgpd.request_id !==
      rgpdRequest.id
    ) {
      const {
        error: associateError,
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

      if (associateError) {
        console.error(
          'Erro ao associar RGPD pendente:',
          associateError,
        );

        return {
          success: false,
          code: 'DATABASE_ERROR',
          message:
            'Não foi possível preparar o RGPD.',
        };
      }
    }
  }

  /* =======================================================
     NÃO EXISTE PENDING

     Só aqui criamos UM.
  ======================================================= */

  else {
    const {
      data: newDocument,
      error: createDocumentError,
    } = await admin
      .from('documents')
      .insert({
        process_id:
          creditProcess.id,

        client_id:
          creditProcess.client_id,

        request_id:
          rgpdRequest.id,

        type: 'rgpd',

        status: 'pending',
      })
      .select('id')
      .single();

    if (
      createDocumentError ||
      !newDocument
    ) {
      console.error(
        'Erro ao criar documento RGPD:',
        createDocumentError,
      );

      return {
        success: false,
        code: 'DATABASE_ERROR',
        message:
          'Não foi possível preparar o documento RGPD.',
      };
    }

    rgpdDocumentId =
      newDocument.id;
  }

  /* =======================================================
     INVALIDAR TOKENS DE ASSINATURA ANTIGOS

     Isto NÃO elimina documentos.
     Só invalida acessos antigos à assinatura.
  ======================================================= */

  const {
    error: revokeTokensError,
  } = await admin
    .from('signature_tokens')
    .update({
      revoked_at:
        new Date().toISOString(),
    })
    .eq(
      'document_id',
      rgpdDocumentId,
    )
    .is('used_at', null)
    .is('revoked_at', null);

  if (revokeTokensError) {
    console.error(
      'Erro ao revogar tokens de assinatura antigos:',
      revokeTokensError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível iniciar a assinatura.',
    };
  }

  /* =======================================================
     CRIAR NOVO TOKEN DE ASSINATURA

     O portal continua igual.
     O token de assinatura é temporário.
  ======================================================= */

  const rawSignatureToken =
    generateSignatureToken();

  const signatureTokenHash =
    hashSignatureToken(
      rawSignatureToken,
    );

  const signatureExpiresAt =
    new Date(
      Date.now() +
        60 * 60 * 1000,
    );

  const {
    error: signatureTokenError,
  } = await admin
    .from('signature_tokens')
    .insert({
      document_id:
        rgpdDocumentId,

      token_hash:
        signatureTokenHash,

      expires_at:
        signatureExpiresAt.toISOString(),
    });

  if (signatureTokenError) {
    console.error(
      'Erro ao criar token de assinatura:',
      signatureTokenError,
    );

    return {
      success: false,
      code: 'DATABASE_ERROR',
      message:
        'Não foi possível iniciar a assinatura.',
    };
  }

  /* =======================================================
     ABRIR EDITOR RGPD

     Enviamos também portal= para depois
     conseguirmos regressar à documentação.
  ======================================================= */

  return {
    success: true,

    url:
      `/assinar/${rawSignatureToken}` +
      `?portal=${encodeURIComponent(
        portalToken,
      )}`,
  };
}