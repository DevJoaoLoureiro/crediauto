'use client';

import {
  useRef,
  useState,
  useTransition,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

type Props = {
  portalToken: string;
  requestId: string;
  receivedCount: number;
  quantityRequired: number;
};

export default function DocumentUpload({
  portalToken,
  requestId,
  receivedCount,
  quantityRequired,
}: Props) {
  const router =
    useRouter();

  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null,
  );

  const remaining =
    Math.max(
      quantityRequired -
        receivedCount,
      0,
    );

  function uploadFile() {
    const file =
      inputRef.current
        ?.files?.[0];

    if (!file) {
      setError(
        'Selecione um ficheiro.',
      );

      return;
    }

    setError(null);
    setSuccessMessage(null);

    startTransition(
      async () => {
        try {
          const formData =
            new FormData();

          formData.append(
            'file',
            file,
          );

          const response =
            await fetch(
              `/api/client-portal/${encodeURIComponent(
                portalToken,
              )}/documents/${encodeURIComponent(
                requestId,
              )}`,
              {
                method: 'POST',
                body: formData,
              },
            );

          const result =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            setError(
              result.message ??
                'Não foi possível enviar o ficheiro.',
            );

            return;
          }

          if (
            inputRef.current
          ) {
            inputRef.current.value =
              '';
          }

          setSuccessMessage(
            result.status ===
              'completed'
              ? 'Documento recebido. Pedido concluído.'
              : 'Documento recebido com sucesso.',
          );

          router.refresh();
        } catch (error) {
          console.error(
            'Erro no upload:',
            error,
          );

          setError(
            'Não foi possível enviar o ficheiro.',
          );
        }
      },
    );
  }

  if (
    remaining <= 0
  ) {
    return (
      <span className="text-sm font-medium text-emerald-600">
        ✓ Concluído
      </span>
    );
  }

  return (
    <div className="w-full sm:w-[270px]">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        disabled={isPending}
        className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-60"
      />

      <button
        type="button"
        onClick={
          uploadFile
        }
        disabled={isPending}
        className="mt-2 w-full rounded-lg bg-[#006571] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#00535d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? 'A enviar...'
          : remaining === 1
            ? 'Enviar documento'
            : `Enviar ficheiro (${remaining} em falta)`}
      </button>

      <p className="mt-2 text-[11px] leading-4 text-gray-400">
        PDF, JPG ou PNG · máximo 10 MB.
      </p>

      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {successMessage && (
        <p className="mt-2 text-xs text-emerald-600">
          {successMessage}
        </p>
      )}
    </div>
  );
}