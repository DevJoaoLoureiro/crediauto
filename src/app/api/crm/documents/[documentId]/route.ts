import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@/lib/supabase/server';

import {
  createAdminClient,
} from '@/lib/supabase/admin';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const {
    documentId,
  } = await context.params;

  /*
   * ========================================================
   * 1. VALIDAR INPUT
   * ========================================================
   */

  if (!documentId) {
    return NextResponse.json(
      {
        message:
          'Documento inválido.',
      },
      {
        status: 400,
      },
    );
  }

  const mode =
    request.nextUrl.searchParams.get(
      'mode',
    );

  if (
    mode !== 'view' &&
    mode !== 'download'
  ) {
    return NextResponse.json(
      {
        message:
          'Modo inválido.',
      },
      {
        status: 400,
      },
    );
  }

  /*
   * ========================================================
   * 2. VALIDAR UTILIZADOR CRM
   * ========================================================
   */

  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
    error: authError,
  } =
    await supabase.auth.getUser();

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        message:
          'Não autenticado.',
      },
      {
        status: 401,
      },
    );
  }

  /*
   * ========================================================
   * 3. CARREGAR DOCUMENTO ATRAVÉS DE RLS
   *
   * IMPORTANTE:
   * Usamos o cliente normal primeiro.
   *
   * Portanto o service role nunca decide sozinho
   * se o utilizador pode aceder ao documento.
   * ========================================================
   */

  const {
    data: document,
    error: documentError,
  } = await supabase
    .from('documents')
    .select(`
      id,
      process_id,
      client_id,
      file_name,
      storage_path,
      mime_type,
      status
    `)
    .eq(
      'id',
      documentId,
    )
    .maybeSingle();

  if (
    documentError
  ) {
    console.error(
      'Erro a consultar documento:',
      documentError,
    );

    return NextResponse.json(
      {
        message:
          'Não foi possível consultar o documento.',
      },
      {
        status: 500,
      },
    );
  }

  /*
   * Se o documento existe mas o utilizador
   * não tem acesso via RLS, também recebemos null.
   *
   * Não revelamos se existe ou não.
   */
  if (!document) {
    return NextResponse.json(
      {
        message:
          'Documento não encontrado.',
      },
      {
        status: 404,
      },
    );
  }

  /*
   * ========================================================
   * 4. CONFIRMAR QUE EXISTE FICHEIRO
   * ========================================================
   */

  if (
    !document.storage_path
  ) {
    return NextResponse.json(
      {
        message:
          'Este documento ainda não possui ficheiro.',
      },
      {
        status: 404,
      },
    );
  }

  /*
   * ========================================================
   * 5. CRIAR URL ASSINADO
   *
   * Só agora usamos service role.
   *
   * URL válido por apenas 60 segundos.
   * ========================================================
   */

  const admin =
    createAdminClient();

  if (
    mode === 'download'
  ) {
    const downloadName =
      sanitizeDownloadName(
        document.file_name ??
          'documento',
      );

    const {
      data,
      error,
    } = await admin.storage
      .from(
        'client-documents',
      )
      .createSignedUrl(
        document.storage_path,
        60,
        {
          download:
            downloadName,
        },
      );

    if (
      error ||
      !data?.signedUrl
    ) {
      console.error(
        'Erro a criar URL de download:',
        error,
      );

      return NextResponse.json(
        {
          message:
            'Não foi possível preparar o download.',
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.redirect(
      data.signedUrl,
      302,
    );
  }

  /*
   * ========================================================
   * VISUALIZAÇÃO
   * ========================================================
   */

  const {
    data,
    error,
  } = await admin.storage
    .from(
      'client-documents',
    )
    .createSignedUrl(
      document.storage_path,
      60,
    );

  if (
    error ||
    !data?.signedUrl
  ) {
    console.error(
      'Erro a criar URL de visualização:',
      error,
    );

    return NextResponse.json(
      {
        message:
          'Não foi possível abrir o documento.',
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.redirect(
    data.signedUrl,
    302,
  );
}

function sanitizeDownloadName(
  value: string,
) {
  const safe =
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
    safe ||
    'documento'
  );
}