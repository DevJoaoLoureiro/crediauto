'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { hashClientPortalToken } from '@/lib/client-portal/tokens';
import {
  generateSignatureToken,
  hashSignatureToken,
} from '@/lib/signatures/token';
import { ensureRgpdState } from '@/lib/rgpd/ensure-rgpd-state';
import { isExpired } from '@/lib/format';

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
   INICIAR RGPD PELO PORTAL
========================================================= */

export async function startRgpdFromPortalAction(
  portalToken: string,
  requestId: string,
): Promise<StartRgpdResult> {
  if (
    !portalToken ||
    portalToken.length < 20 ||
    portalToken.length > 200
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
      hashClientPortalToken(portalToken),
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

  if (isExpired(portal.expires_at)) {
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
     INTERVENIENTE QUE VAI ASSINAR

     O pedido RGPD tem de pertencer ao processo deste portal.
     Pedidos antigos sem registo usam o cliente do processo.
  ======================================================= */

  let signerClientId = creditProcess.client_id;
  let rgpdLabel = 'RGPD';

  if (!requestId.startsWith('legacy-')) {
    const {
      data: rgpdRequest,
      error: rgpdRequestError,
    } = await admin
      .from('document_requests')
      .select('id, client_id, label')
      .eq('id', requestId)
      .eq('process_id', creditProcess.id)
      .eq('type', 'rgpd')
      .maybeSingle();

    if (rgpdRequestError || !rgpdRequest) {
      if (rgpdRequestError) {
        console.error(
          'Erro ao carregar pedido RGPD:',
          rgpdRequestError,
        );
      }

      return {
        success: false,
        code: 'INVALID_PORTAL',
        message:
          'Este pedido de RGPD não pertence a este processo.',
      };
    }

    signerClientId = rgpdRequest.client_id;
    rgpdLabel = rgpdRequest.label || 'RGPD';
  }

  /* =======================================================
     GARANTIR RGPD (idempotente)

     Assinado -> termina.
     Pendente -> reutiliza.
     Nenhum   -> cria UM.
  ======================================================= */

  let rgpd;

  try {
    rgpd = await ensureRgpdState(
      admin,
      creditProcess.id,
      signerClientId,
      null,
      rgpdLabel,
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
        'Não foi possível preparar o documento RGPD.',
    };
  }

  if (rgpd.signed) {
    return {
      success: false,
      code: 'RGPD_ALREADY_SIGNED',
      message:
        'Este RGPD já se encontra assinado.',
    };
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
      rgpd.documentId,
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
     O token de assinatura é temporário (1 hora).
  ======================================================= */

  const rawSignatureToken =
    generateSignatureToken();

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
        rgpd.documentId,

      token_hash:
        hashSignatureToken(
          rawSignatureToken,
        ),

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
