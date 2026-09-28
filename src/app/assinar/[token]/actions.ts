'use server';

import { readFile } from 'fs/promises';
import { join } from 'path';

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import { createAdminClient } from '@/lib/supabase/admin';
import { hashSignatureToken } from '@/lib/signatures/token';
import { logProcessEvent } from '@/lib/crm/events';

type ConsentValue = 'yes' | 'no' | '';

export type RgpdSubmission = {
  fullName: string;
  identificationNumber: string;
  nif: string;

  dataSharing: ConsentValue;
  dataReceiving: ConsentValue;
  marketing: ConsentValue;

  signatureImage: string;
  signatureDate: string;
};

export type SubmitRgpdResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

const PDF_HEIGHT = 841.92;

export async function submitRgpdAction(
  token: string,
  data: RgpdSubmission,
): Promise<SubmitRgpdResult> {
  try {
    /*
     * ========================================================
     * 1. VALIDAR DADOS RECEBIDOS
     * ========================================================
     */

    if (!token || token.length > 200) {
      return {
        success: false,
        error: 'Link inválido.',
      };
    }

    const fullName =
      data.fullName.trim();

    const identificationNumber =
      data.identificationNumber.trim();

    const nif = data.nif.replace(/\D/g, '');

    if (!fullName) {
      return {
        success: false,
        error: 'Preencha o nome completo.',
      };
    }

    if (!identificationNumber) {
      return {
        success: false,
        error:
          'Preencha o número de identificação.',
      };
    }

    if (!/^\d{9}$/.test(nif)) {
      return {
        success: false,
        error:
          'O NIF deve ter 9 dígitos.',
      };
    }

    if (
      !isConsent(data.dataSharing) ||
      !isConsent(data.dataReceiving) ||
      !isConsent(data.marketing)
    ) {
      return {
        success: false,
        error:
          'Selecione todas as opções de consentimento.',
      };
    }

    if (
      !data.signatureImage ||
      !data.signatureImage.startsWith(
        'data:image/png;base64,',
      )
    ) {
      return {
        success: false,
        error:
          'É necessária uma assinatura válida.',
      };
    }

    if (
      data.signatureImage.length >
      3_000_000
    ) {
      return {
        success: false,
        error:
          'A assinatura é demasiado grande.',
      };
    }

    /*
     * ========================================================
     * 2. VALIDAR TOKEN
     * ========================================================
     */

    const supabase =
      createAdminClient();

    const tokenHash =
      hashSignatureToken(token);

    const {
      data: signatureToken,
      error: signatureTokenError,
    } = await supabase
      .from('signature_tokens')
      .select(`
        id,
        document_id,
        expires_at,
        used_at,
        revoked_at
      `)
      .eq('token_hash', tokenHash)
      .single();

    if (
      signatureTokenError ||
      !signatureToken
    ) {
      console.error(
        'Token RGPD não encontrado:',
        signatureTokenError,
      );

      return {
        success: false,
        error:
          'O link de assinatura não é válido.',
      };
    }

    if (signatureToken.revoked_at) {
      return {
        success: false,
        error:
          'Este link foi revogado.',
      };
    }

    if (signatureToken.used_at) {
      return {
        success: false,
        error:
          'Este documento já foi submetido.',
      };
    }

    const expiresAt =
      new Date(
        signatureToken.expires_at,
      );

    if (
      expiresAt.getTime() <
      Date.now()
    ) {
      return {
        success: false,
        error:
          'Este link expirou. Solicite um novo link à CrediAuto.',
      };
    }

    /*
     * ========================================================
     * 3. OBTER DOCUMENTO
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
            request_id,
            type,
            status
            `)
      .eq(
        'id',
        signatureToken.document_id,
      )
      .single();

    if (
      documentError ||
      !document
    ) {
      console.error(
        'Documento não encontrado:',
        documentError,
      );

      return {
        success: false,
        error:
          'Documento associado ao link não encontrado.',
      };
    }

    if (document.type !== 'rgpd') {
      return {
        success: false,
        error:
          'O documento associado não é um RGPD.',
      };
    }

    if (document.status === 'signed') {
      return {
        success: false,
        error:
          'Este documento já foi assinado.',
      };
    }

    /*
     * ========================================================
     * 4. CARREGAR O RGPD ORIGINAL
     *
     * IMPORTANTE:
     * O teu ficheiro chama-se RGPD.pdf
     * ========================================================
     */

    const templatePath = join(
      process.cwd(),
      'public',
      'documents',
      'RGPD.pdf',
    );

    const templateBytes =
      await readFile(templatePath);

    const pdfDocument =
      await PDFDocument.load(
        templateBytes,
      );

    const pages =
      pdfDocument.getPages();

    if (pages.length < 6) {
      return {
        success: false,
        error:
          'O modelo RGPD não contém as 6 páginas esperadas.',
      };
    }

    const font =
      await pdfDocument.embedFont(
        StandardFonts.Helvetica,
      );

    /*
     * ========================================================
     * 5. PÁGINA 4
     *
     * Mantemos as coordenadas que já medimos.
     * ========================================================
     */

    const page4 = pages[3];

    drawText(
      page4,
      fullName,
      202.61,
      150.5,
      font,
    );

    drawText(
      page4,
      identificationNumber,
      202.61,
      173.66,
      font,
    );

    drawText(
      page4,
      nif,
      201.89,
      196.82,
      font,
    );

    /*
     * ========================================================
     * 6. PÁGINA 5
     *
     * Envio de dados
     * ========================================================
     */

    const page5 = pages[4];

    drawConsent(
      page5,
      570,
      data.dataSharing,
    );

    /*
     * ========================================================
     * 7. PÁGINA 6
     *
     * Receção de dados
     * Marketing
     * ========================================================
     */

    const page6 = pages[5];

    drawConsent(
      page6,
      117,
      data.dataReceiving,
    );

    drawConsent(
      page6,
      298,
      data.marketing,
    );

    /*
     * ========================================================
     * 8. ASSINATURA
     * ========================================================
     */

    const signatureBase64 =
      data.signatureImage.split(',')[1];

    if (!signatureBase64) {
      return {
        success: false,
        error:
          'Não foi possível processar a assinatura.',
      };
    }

    const signatureBytes =
      Buffer.from(
        signatureBase64,
        'base64',
      );

    const signatureImage =
      await pdfDocument.embedPng(
        signatureBytes,
      );

    /*
     * Estas são as mesmas coordenadas visuais
     * que já tens no editor:
     *
     * left = 118
     * top = 477
     * width = 220
     * height = 50
     */

    const signatureX = 118.46;

    const signatureLineY = 521.95;

    const signatureMaxWidth = 220;
    const signatureMaxHeight = 45;

    const imageWidth =
    signatureImage.width;

    const imageHeight =
    signatureImage.height;

    const scale = Math.min(
    signatureMaxWidth / imageWidth,
    signatureMaxHeight / imageHeight,
    );

    const finalSignatureWidth =
    imageWidth * scale;

    const finalSignatureHeight =
    imageHeight * scale;

    /*
    * Encostamos a assinatura à linha original,
    * sem passar para baixo dela.
    */
    const signatureBottom =
    PDF_HEIGHT - signatureLineY + 2;

    page6.drawImage(
    signatureImage,
    {
        x: signatureX,

        y: signatureBottom,

        width:
        finalSignatureWidth,

        height:
        finalSignatureHeight,
    },
    );

    /*
     * ========================================================
     * 9. DATA
     *
     * A data final vem do servidor, não do browser.
     * ========================================================
     */

    const signedDate =
      new Intl.DateTimeFormat(
        'pt-PT',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone:
            'Europe/Lisbon',
        },
      ).format(new Date());

    drawText(
        page6,
        signedDate,
        117.74,
        547.51,
        font,
        );

    /*
     * ========================================================
     * 10. GERAR PDF FINAL
     * ========================================================
     */

    const finalPdfBytes =
      await pdfDocument.save();

    /*
     * ========================================================
     * 11. GUARDAR NO SUPABASE STORAGE
     * ========================================================
     */

    const storagePath = [
      document.client_id,
      document.process_id,
      'rgpd',
      `${document.id}.pdf`,
    ].join('/');

    const {
      error: uploadError,
    } = await supabase.storage
      .from('client-documents')
      .upload(
        storagePath,
        finalPdfBytes,
        {
          contentType:
            'application/pdf',

          upsert: false,
        },
      );

    if (uploadError) {
      console.error(
        'Erro ao guardar PDF:',
        uploadError,
      );

      return {
        success: false,
        error:
          'Não foi possível guardar o documento assinado.',
      };
    }

    /*
     * ========================================================
     * 12. MARCAR DOCUMENTO COMO ASSINADO
     * ========================================================
     */

    const signedAt =
      new Date().toISOString();

    const {
      error: updateDocumentError,
    } = await supabase
      .from('documents')
      .update({
        status: 'signed',

        storage_path:
          storagePath,

        file_name:
          'RGPD-assinado.pdf',

        mime_type:
          'application/pdf',

        file_size:
          finalPdfBytes.length,

        signed_at:
          signedAt,
      })
      .eq('id', document.id);

    if (updateDocumentError) {
      console.error(
        'Erro ao atualizar documento:',
        updateDocumentError,
      );

      /*
       * Se a DB falhar, apagamos o ficheiro
       * que acabámos de enviar.
       */
      await supabase.storage
        .from('client-documents')
        .remove([
          storagePath,
        ]);

      return {
        success: false,
        error:
          'Não foi possível concluir a submissão.',
      };
    }
    


    /*
        * ========================================================
        * 12.5 MARCAR O PEDIDO RGPD COMO CONCLUÍDO
        * ========================================================
        */

    if (document.request_id) {
    const {
        error: completeRequestError,
    } = await supabase
        .from('document_requests')
        .update({
        status: 'completed',
        })
        .eq(
        'id',
        document.request_id,
        );

    if (completeRequestError) {
        console.error(
        'Erro ao concluir pedido RGPD:',
        completeRequestError,
        );

        return {
        success: false,
        error:
            'O RGPD foi recebido, mas ocorreu um erro ao atualizar o estado do pedido.',
        };
    }
    }
    /*
     * ========================================================
     * 13. CONSUMIR TOKEN
     * ========================================================
     */

    const {
      data: consumedToken,
      error: consumeError,
    } = await supabase
      .from('signature_tokens')
      .update({
        used_at:
          signedAt,
      })
      .eq(
        'id',
        signatureToken.id,
      )
      .is(
        'used_at',
        null,
      )
      .select('id')
      .maybeSingle();

    if (
      consumeError ||
      !consumedToken
    ) {
      console.error(
        'Erro ao consumir token:',
        consumeError,
      );

      /*
       * O documento já está guardado.
       * Não o apagamos nesta fase.
       */
      return {
        success: false,
        error:
          'O documento foi recebido, mas ocorreu um erro ao finalizar o link.',
      };
    }

    await logProcessEvent(supabase, {
      processId: document.process_id,
      type: 'rgpd_signed',
      data: {
        client_id: document.client_id,
        document_id: document.id,
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      'Erro submitRgpdAction:',
      error,
    );

    return {
      success: false,
      error:
        'Ocorreu um erro ao processar o documento.',
    };
  }
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function isConsent(
  value: ConsentValue,
): value is 'yes' | 'no' {
  return (
    value === 'yes' ||
    value === 'no'
  );
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  topY: number,
  font: PDFFont,
) {
  page.drawText(text, {
    x,

    /*
     * O browser mede Y a partir do topo.
     * pdf-lib mede Y a partir do fundo.
     */
    y:
      PDF_HEIGHT -
      topY +
      2,

    size: 10,

    font,

    color:
      rgb(0, 0, 0),
  });
}

function drawConsent(
  page: PDFPage,
  topY: number,
  value: 'yes' | 'no',
) {
  const boxX = 116.5;
  const boxSize = 21;

  /*
   * "Não Autorizo" está 26 pontos
   * abaixo de "Autorizo".
   */
  const selectedTop =
    value === 'yes'
      ? topY
      : topY + 26;

  /*
   * Desenhamos um X dentro da caixa.
   */
  const padding = 5;

  const left =
    boxX + padding;

  const right =
    boxX +
    boxSize -
    padding;

  const top =
    PDF_HEIGHT -
    selectedTop -
    padding;

  const bottom =
    PDF_HEIGHT -
    selectedTop -
    boxSize +
    padding;

  page.drawLine({
    start: {
      x: left,
      y: bottom,
    },

    end: {
      x: right,
      y: top,
    },

    thickness: 1.5,

    color:
      rgb(0, 0, 0),
  });

  page.drawLine({
    start: {
      x: left,
      y: top,
    },

    end: {
      x: right,
      y: bottom,
    },

    thickness: 1.5,

    color:
      rgb(0, 0, 0),
  });
}