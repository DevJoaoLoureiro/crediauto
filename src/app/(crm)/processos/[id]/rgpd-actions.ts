'use server';

import { createClient } from '@/lib/supabase/server';

import {
  generateSignatureToken,
  hashSignatureToken,
} from '@/lib/signatures/token';

type GenerateRgpdLinkResult =
  | {
      success: true;
      url: string;
    }
  | {
      success: false;
      error: string;
    };

export async function generateRgpdLinkAction(
  processId: string,
): Promise<GenerateRgpdLinkResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'Sessão inválida.',
    };
  }

  const {
    data: creditProcess,
    error: processError,
  } = await supabase
    .from('credit_processes')
    .select(`
      id,
      reference,
      client_id
    `)
    .eq('id', processId)
    .single();

  if (processError || !creditProcess) {
    return {
      success: false,
      error: 'Processo não encontrado.',
    };
  }

  const {
    data: document,
    error: documentError,
  } = await supabase
    .from('documents')
    .insert({
      process_id: creditProcess.id,
      client_id: creditProcess.client_id,
      type: 'rgpd',
      status: 'pending',
      file_name: `RGPD-${creditProcess.reference ?? creditProcess.id}.pdf`,
      mime_type: 'application/pdf',
    })
    .select('id')
    .single();

  if (documentError || !document) {
    console.error(
      'Erro a criar documento RGPD:',
      documentError,
    );

    return {
      success: false,
      error:
        'Não foi possível criar o documento RGPD.',
    };
  }

  const rawToken = generateSignatureToken();
  const tokenHash =
    hashSignatureToken(rawToken);

  const expiresAt = new Date();

  expiresAt.setDate(
    expiresAt.getDate() + 7,
  );

  const { error: tokenError } =
    await supabase
      .from('signature_tokens')
      .insert({
        document_id: document.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

  if (tokenError) {
    console.error(
      'Erro ao criar token:',
      tokenError,
    );

    await supabase
      .from('documents')
      .delete()
      .eq('id', document.id);

    return {
      success: false,
      error:
        'Não foi possível gerar o link.',
    };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  return {
    success: true,
    url: `${baseUrl}/assinar/${rawToken}`,
  };
}