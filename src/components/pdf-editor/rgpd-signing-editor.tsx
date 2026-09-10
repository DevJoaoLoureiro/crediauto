'use client';

import {
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import PdfEditorLoader from '@/components/pdf-editor/pdf-editor-loader';

import type {
  RgpdFormData,
} from '@/components/pdf-editor/pdf-editor';

import {
  submitRgpdAction,
} from '@/app/assinar/[token]/actions';

type RgpdSigningEditorProps = {
  token: string;
  portalToken: string | null;
};

export default function RgpdSigningEditor({
  token,
  portalToken,
}: RgpdSigningEditorProps) {
  const router = useRouter();

  const [
    serverError,
    setServerError,
  ] = useState<string | null>(
    null,
  );

  const [
    redirecting,
    setRedirecting,
  ] = useState(false);

  async function handleSubmit(
    data: RgpdFormData,
  ) {
    setServerError(null);

    const result =
      await submitRgpdAction(
        token,
        data,
      );

    if (!result.success) {
      setServerError(
        result.error,
      );

      throw new Error(
        result.error,
      );
    }

    /*
     * O RGPD terminou.
     *
     * Se veio do portal, voltamos para
     * EXATAMENTE o mesmo portal.
     */
    if (portalToken) {
      setRedirecting(true);

      router.replace(
        `/documentos-cliente/${encodeURIComponent(
          portalToken,
        )}`,
      );

      router.refresh();

      return;
    }

    /*
     * Fallback para um RGPD aberto
     * diretamente sem portal.
     */
    setRedirecting(true);
  }

  if (redirecting) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>

        <h2 className="mt-5 text-xl font-semibold text-gray-950">
          RGPD submetido
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
          O documento foi recebido com sucesso.
        </p>

        {portalToken ? (
          <p className="mt-5 text-sm font-medium text-[#006571]">
            A regressar ao portal...
          </p>
        ) : (
          <p className="mt-5 text-sm font-medium text-[#006571]">
            Documento concluído com sucesso.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {serverError && (
        <div className="mx-auto mb-5 max-w-[800px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <PdfEditorLoader
        pdfUrl="/documents/RGPD.pdf"
        onSubmit={
          handleSubmit
        }
      />
    </div>
  );
}