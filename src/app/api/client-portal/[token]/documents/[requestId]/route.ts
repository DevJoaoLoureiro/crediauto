import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  hashClientPortalToken,
} from '@/lib/client-portal/tokens';

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const allowedMimeTypes =
  new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
  ]);

type RouteContext = {
  params: Promise<{
    token: string;
    requestId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const {
    token,
    requestId,
  } = await context.params;

  if (
    !token ||
    token.length > 200 ||
    !requestId
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'Pedido inválido.',
      },
      {
        status: 400,
      },
    );
  }

  const admin =
    createAdminClient();

  /*
   * ========================================================
   * 1. VALIDAR PORTAL
   * ========================================================
   */

  const tokenHash =
    hashClientPortalToken(
      token,
    );

  const now =
    new Date().toISOString();

  const {
    data: portal,
    error: portalError,
  } = await admin
    .from(
      'client_portal_tokens',
    )
    .select(`
      id,
      process_id,
      expires_at,
      revoked_at
    `)
    .eq(
      'token_hash',
      tokenHash,
    )
    .is(
      'revoked_at',
      null,
    )
    .gt(
      'expires_at',
      now,
    )
    .maybeSingle();

  if (
    portalError ||
    !portal
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Portal inválido ou expirado.',
      },
      {
        status: 403,
      },
    );
  }

  /*
   * ========================================================
   * 2. VALIDAR PEDIDO
   * ========================================================
   */

  const {
    data: documentRequest,
    error: requestError,
  } = await admin
    .from(
      'document_requests',
    )
    .select(`
      id,
      process_id,
      client_id,
      type,
      quantity_required,
      status
    `)
    .eq(
      'id',
      requestId,
    )
    .eq(
      'process_id',
      portal.process_id,
    )
    .neq(
      'status',
      'cancelled',
    )
    .maybeSingle();

  if (
    requestError ||
    !documentRequest
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Pedido de documento não encontrado.',
      },
      {
        status: 404,
      },
    );
  }

  /*
   * O RGPD nunca é carregado manualmente.
   */
  if (
    documentRequest.type ===
    'rgpd'
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'O RGPD deve ser preenchido e assinado no portal.',
      },
      {
        status: 400,
      },
    );
  }

  /*
   * ========================================================
   * 3. CONTAR DOCUMENTOS VÁLIDOS JÁ RECEBIDOS
   * ========================================================
   */

  const {
    data: existingDocuments,
    error: existingError,
  } = await admin
    .from('documents')
    .select(`
      id,
      status
    `)
    .eq(
      'request_id',
      documentRequest.id,
    )
    .in(
      'status',
      [
        'received',
        'signed',
      ],
    );

  if (
    existingError
  ) {
    console.error(
      'Erro ao consultar documentos existentes:',
      existingError,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          'Não foi possível verificar os documentos existentes.',
      },
      {
        status: 500,
      },
    );
  }

  const existingCount =
    existingDocuments?.length ??
    0;

  if (
    existingCount >=
    documentRequest.quantity_required
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Este pedido já está completo.',
      },
      {
        status: 409,
      },
    );
  }

  /*
   * ========================================================
   * 4. LER FICHEIRO
   * ========================================================
   */

  let formData: FormData;

  try {
    formData =
      await request.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message:
          'Não foi possível processar o ficheiro.',
      },
      {
        status: 400,
      },
    );
  }

  const file =
    formData.get('file');

  if (
    !(file instanceof File)
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Selecione um ficheiro.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    file.size <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'O ficheiro está vazio.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'O ficheiro não pode ultrapassar 10 MB.',
      },
      {
        status: 400,
      },
    );
  }

  /*
   * ========================================================
   * 5. VALIDAR MIME DECLARADO
   * ========================================================
   */

  if (
    !allowedMimeTypes.has(
      file.type,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Formato inválido. Utilize PDF, JPG ou PNG.',
      },
      {
        status: 400,
      },
    );
  }

  /*
   * ========================================================
   * 6. LER BYTES E VALIDAR ASSINATURA REAL DO FICHEIRO
   * ========================================================
   */

  const bytes =
    new Uint8Array(
      await file.arrayBuffer(),
    );

  if (
    !hasValidFileSignature(
      bytes,
      file.type,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'O conteúdo do ficheiro não corresponde ao formato indicado.',
      },
      {
        status: 400,
      },
    );
  }

  /*
   * ========================================================
   * 7. GERAR ID E CAMINHO CONTROLADOS PELO SERVIDOR
   * ========================================================
   */

  const documentId =
    randomUUID();

  const extension =
    getExtension(
      file.type,
    );

  const storagePath = [
    documentRequest.client_id,
    documentRequest.process_id,
    documentRequest.type,
    `${documentId}.${extension}`,
  ].join('/');

  /*
   * ========================================================
   * 8. ENVIAR PARA STORAGE PRIVADO
   * ========================================================
   */

  const {
    error: uploadError,
  } = await admin.storage
    .from(
      'client-documents',
    )
    .upload(
      storagePath,
      bytes,
      {
        contentType:
          file.type,

        upsert: false,
      },
    );

  if (
    uploadError
  ) {
    console.error(
      'Erro no upload do documento:',
      uploadError,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          'Não foi possível guardar o ficheiro.',
      },
      {
        status: 500,
      },
    );
  }

  /*
   * ========================================================
   * 9. REGISTAR DOCUMENTO NA BASE DE DADOS
   * ========================================================
   */

  const {
    error: insertError,
  } = await admin
    .from('documents')
    .insert({
      id:
        documentId,

      request_id:
        documentRequest.id,

      process_id:
        documentRequest.process_id,

      client_id:
        documentRequest.client_id,

      type:
        documentRequest.type,

      status:
        'received',

      /*
       * Só para apresentação no CRM.
       * O nome NÃO é usado para gerar o caminho no Storage.
       */
      file_name:
        sanitizeFileName(
          file.name,
        ),

      storage_path:
        storagePath,

      mime_type:
        file.type,

      file_size:
        file.size,
    });

  if (
    insertError
  ) {
    console.error(
      'Erro a registar documento:',
      insertError,
    );

    /*
     * O Storage já recebeu o ficheiro.
     * Se a DB falhar, apagamos esse objeto.
     */
    const {
      error: cleanupError,
    } = await admin.storage
      .from(
        'client-documents',
      )
      .remove([
        storagePath,
      ]);

    if (
      cleanupError
    ) {
      console.error(
        'Erro ao limpar upload órfão:',
        cleanupError,
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          'Não foi possível registar o documento.',
      },
      {
        status: 500,
      },
    );
  }

  /*
   * ========================================================
   * 10. ATUALIZAR ESTADO DO PEDIDO
   * ========================================================
   */

  const newCount =
    existingCount + 1;

  const newStatus =
    newCount >=
    documentRequest.quantity_required
      ? 'completed'
      : 'partial';

  const {
    error: updateRequestError,
  } = await admin
    .from(
      'document_requests',
    )
    .update({
      status:
        newStatus,
    })
    .eq(
      'id',
      documentRequest.id,
    );

  if (
    updateRequestError
  ) {
    /*
     * O documento foi efetivamente recebido.
     * Não apagamos ficheiro nem linha documents.
     *
     * Isto evita perder documentação enviada pelo cliente.
     */
    console.error(
      'Documento recebido, mas erro ao atualizar pedido:',
      updateRequestError,
    );
  }

  return NextResponse.json(
    {
      success: true,

      documentId,

      status:
        newStatus,

      receivedCount:
        newCount,
    },
    {
      status: 201,
    },
  );
}

/*
 * ==========================================================
 * HELPERS
 * ==========================================================
 */

function getExtension(
  mimeType: string,
) {
  switch (
    mimeType
  ) {
    case 'application/pdf':
      return 'pdf';

    case 'image/jpeg':
      return 'jpg';

    case 'image/png':
      return 'png';

    default:
      return 'bin';
  }
}

function sanitizeFileName(
  value: string,
) {
  const sanitized =
    value
      .normalize('NFKC')
      .replace(
        /[^\p{L}\p{N}._ ()-]/gu,
        '_',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim()
      .slice(
        0,
        180,
      );

  return (
    sanitized ||
    'documento'
  );
}

function hasValidFileSignature(
  bytes: Uint8Array,
  mimeType: string,
) {
  /*
   * ========================================================
   * PDF
   *
   * %PDF-
   *
   * Hex:
   * 25 50 44 46 2D
   * ========================================================
   */

  if (
    mimeType ===
    'application/pdf'
  ) {
    return (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    );
  }

  /*
   * ========================================================
   * JPEG
   *
   * FF D8 FF
   * ========================================================
   */

  if (
    mimeType ===
    'image/jpeg'
  ) {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  /*
   * ========================================================
   * PNG
   *
   * 89 50 4E 47 0D 0A 1A 0A
   * ========================================================
   */

  if (
    mimeType ===
    'image/png'
  ) {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  return false;
}