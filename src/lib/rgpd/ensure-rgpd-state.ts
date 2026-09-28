import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logProcessEvent } from '@/lib/crm/events';
import { PARTICIPANT_ROLE_LABELS } from '@/lib/crm/labels';

export type RgpdState = {
  requestId: string;
  documentId: string;
  signed: boolean;
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

   Um RGPD por interveniente (cliente) em cada processo:
   1.º titular, 2.º titular, avalista...

   Usado pelo CRM (gerar portal, adicionar interveniente)
   e pelo portal do cliente (iniciar assinatura).
   userId é null quando o pedido é criado a partir do portal.
========================================================= */

export async function ensureRgpdState(
  admin: AdminClient,
  processId: string,
  clientId: string,
  userId: string | null,
  label = 'RGPD',
): Promise<RgpdState> {
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
    .eq('client_id', clientId)
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
    .eq('client_id', clientId)
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

        label,

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

  /*
   * Momento em que o RGPD é pedido: base para medir
   * o tempo até à assinatura nas estatísticas.
   */
  await logProcessEvent(admin, {
    processId,
    type: 'rgpd_requested',
    data: {
      client_id: clientId,
      document_id: newDocument.id,
    },
    createdBy: userId,
  });

  return {
    requestId:
      rgpdRequest.id,
    documentId:
      newDocument.id,
    signed: false,
  };
}

/* =========================================================
   GARANTIR RGPD DE TODOS OS INTERVENIENTES

   Processos sem intervenientes registados (anteriores à
   Fase 1) usam o cliente do processo como 1.º titular.
========================================================= */

export function getRgpdLabel(
  role: string,
  clientName: string | null | undefined,
) {
  if (role === 'primary_holder' || !clientName) {
    return 'RGPD';
  }

  const roleLabel =
    PARTICIPANT_ROLE_LABELS[role] ?? 'Interveniente';

  return `RGPD — ${clientName} (${roleLabel})`;
}

export async function ensureRgpdForAllParticipants(
  admin: AdminClient,
  processId: string,
  processClientId: string,
  userId: string | null,
) {
  const {
    data: participants,
    error,
  } = await admin
    .from('process_participants')
    .select(`
      client_id,
      role,
      clients (
        full_name
      )
    `)
    .eq('process_id', processId);

  if (error) {
    throw new Error(
      `Erro ao carregar intervenientes: ${error.message}`,
    );
  }

  const list =
    participants && participants.length > 0
      ? participants.map((participant) => {
          const client = Array.isArray(participant.clients)
            ? participant.clients[0]
            : participant.clients;

          return {
            clientId: participant.client_id as string,
            label: getRgpdLabel(
              participant.role,
              client?.full_name,
            ),
          };
        })
      : [{ clientId: processClientId, label: 'RGPD' }];

  /*
   * Sequencial de propósito: cada chamada lê e escreve
   * pedidos do mesmo processo.
   */
  const states: RgpdState[] = [];

  for (const participant of list) {
    states.push(
      await ensureRgpdState(
        admin,
        processId,
        participant.clientId,
        userId,
        participant.label,
      ),
    );
  }

  return states;
}
