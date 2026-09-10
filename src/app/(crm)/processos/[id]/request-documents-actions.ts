'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

type DocumentType =
  | 'identity'
  | 'address_proof'
  | 'income_proof'
  | 'salary_receipt'
  | 'bank_statement'
  | 'irs'
  | 'tax_assessment'
  | 'iban_proof'
  | 'pension_proof'
  | 'vehicle_document'
  | 'vehicle_invoice'
  | 'other';

type RequestedDocument = {
  type: DocumentType;
  label: string;
  quantityRequired: number;
  instructions?: string;
};

type RequestDocumentsResult =
  | {
      success: true;
      created: number;
    }
  | {
      success: false;
      message: string;
    };

export async function requestDocumentsAction(
  processId: string,
  requestedDocuments: RequestedDocument[],
): Promise<RequestDocumentsResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      message: 'Sessão inválida.',
    };
  }

  if (!requestedDocuments.length) {
    return {
      success: false,
      message: 'Seleciona pelo menos um documento.',
    };
  }

  /*
   * Validar o processo através do cliente normal.
   * Desta forma continuamos protegidos por RLS.
   */
  const {
    data: creditProcess,
    error: processError,
  } = await supabase
    .from('credit_processes')
    .select(`
      id,
      client_id
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
      message: 'Não foi possível consultar o processo.',
    };
  }

  if (!creditProcess) {
    return {
      success: false,
      message: 'Processo não encontrado.',
    };
  }

  /*
   * Normalização e validação básica.
   */
  const normalizedDocuments = requestedDocuments
    .map((document) => ({
      ...document,

      label: document.label.trim(),

      instructions:
        document.instructions?.trim() || null,

      quantityRequired: Math.max(
        1,
        Math.min(
          12,
          Math.floor(document.quantityRequired),
        ),
      ),
    }))
    .filter((document) => document.label.length > 0);

  if (!normalizedDocuments.length) {
    return {
      success: false,
      message: 'Os pedidos de documentos são inválidos.',
    };
  }

  /*
   * Não permitimos pedir RGPD através deste botão.
   *
   * O RGPD é gerido automaticamente pelo portal.
   */
  const hasInvalidType = normalizedDocuments.some(
    (document) =>
      document.type === ('rgpd' as DocumentType),
  );

  if (hasInvalidType) {
    return {
      success: false,
      message: 'O RGPD é gerido automaticamente.',
    };
  }

  /*
   * Ver quais pedidos ativos já existem.
   *
   * Assim impedimos:
   *
   * Documento de identificação — pending
   * Documento de identificação — pending
   */
  const {
    data: existingRequests,
    error: existingRequestsError,
  } = await supabase
    .from('document_requests')
    .select(`
      id,
      type,
      status
    `)
    .eq('process_id', creditProcess.id)
    .in('status', [
      'pending',
      'partial',
      'completed',
    ]);

  if (existingRequestsError) {
    console.error(
      'Erro ao consultar pedidos existentes:',
      existingRequestsError,
    );

    return {
      success: false,
      message:
        'Não foi possível verificar os documentos já pedidos.',
    };
  }

  const existingTypes = new Set(
    (existingRequests ?? []).map(
      (request) => request.type,
    ),
  );

  /*
   * Só inserimos tipos que ainda não existem.
   *
   * Mais tarde podemos permitir "pedir novamente",
   * mas deve ser uma ação explícita.
   */
  const newDocuments = normalizedDocuments.filter(
    (document) => !existingTypes.has(document.type),
  );

  if (!newDocuments.length) {
    return {
      success: false,
      message:
        'Os documentos selecionados já foram pedidos neste processo.',
    };
  }

  const rows = newDocuments.map((document) => ({
    process_id: creditProcess.id,
    client_id: creditProcess.client_id,

    type: document.type,

    label: document.label,

    instructions: document.instructions,

    quantity_required: document.quantityRequired,

    status: 'pending' as const,

    created_by: user.id,
  }));

  const {
    error: insertError,
  } = await supabase
    .from('document_requests')
    .insert(rows);

  if (insertError) {
    console.error(
      'Erro ao criar pedidos de documentação:',
      insertError,
    );

    return {
      success: false,
      message:
        'Não foi possível adicionar os documentos ao processo.',
    };
  }

  revalidatePath(
    `/processos/${creditProcess.id}`,
  );

  return {
    success: true,
    created: rows.length,
  };
}