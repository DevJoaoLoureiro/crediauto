'use client';

import {
  useEffect,
  useState,
  useTransition,
} from 'react';

import {
  generateClientPortalLinkAction,
  revokeClientPortalAction,
} from '@/app/(crm)/processos/[id]/portal-actions';
import { formatDateTime } from '@/lib/format';

type Props = {
  processId: string;
};

export default function GenerateClientPortalLink({
  processId,
}: Props) {
  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [
    url,
    setUrl,
  ] = useState<string | null>(
    null,
  );

  const [
    expiresAt,
    setExpiresAt,
  ] = useState<string | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    loaded,
    setLoaded,
  ] = useState(false);

  /*
   * ========================================================
   * CARREGAR / RECUPERAR PORTAL ATIVO
   *
   * O server action:
   * - devolve o portal existente, se estiver ativo
   * - cria um novo apenas se não existir nenhum
   * ========================================================
   */
  useEffect(() => {
    let cancelled = false;

    startTransition(
      async () => {
        const result =
          await generateClientPortalLinkAction(
            processId,
          );

        if (cancelled) {
          return;
        }

        if (!result.success) {
          setError(
            result.message,
          );

          setLoaded(true);

          return;
        }

        setUrl(
          result.url,
        );

        setExpiresAt(
          result.expiresAt,
        );

        setLoaded(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [processId]);

  /*
   * ========================================================
   * RECUPERAR / CRIAR MANUALMENTE
   * ========================================================
   */
  function openOrCreatePortal() {
    setError(null);
    setCopied(false);

    startTransition(
      async () => {
        const result =
          await generateClientPortalLinkAction(
            processId,
          );

        if (!result.success) {
          setError(
            result.message,
          );

          return;
        }

        setUrl(
          result.url,
        );

        setExpiresAt(
          result.expiresAt,
        );
      },
    );
  }

  /*
   * ========================================================
   * COPIAR LINK
   * ========================================================
   */
  async function copyLink() {
    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        url,
      );

      setCopied(true);

      setTimeout(
        () => {
          setCopied(false);
        },
        2000,
      );
    } catch {
      setError(
        'Não foi possível copiar o link.',
      );
    }
  }

  /*
   * ========================================================
   * REVOGAR PORTAL
   * ========================================================
   */
  function revokePortal() {
    if (!url) {
      return;
    }

    const confirmed =
      window.confirm(
        'Tem a certeza de que pretende revogar este portal? O cliente deixará de conseguir utilizar este link.',
      );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(
      async () => {
        const result =
          await revokeClientPortalAction(
            processId,
          );

        if (!result.success) {
          setError(
            result.message,
          );

          return;
        }

        setUrl(null);
        setExpiresAt(null);
        setCopied(false);
      },
    );
  }

  /*
   * ========================================================
   * ESTADO INICIAL
   * ========================================================
   */
  if (!loaded) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white opacity-60"
        >
          A carregar portal...
        </button>
      </div>
    );
  }

  return (
    <div>
      {!url ? (
        <button
          type="button"
          disabled={isPending}
          onClick={
            openOrCreatePortal
          }
          className="rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00535d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? 'A preparar...'
            : 'Criar portal do cliente'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                ✓
              </span>

              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Portal ativo
                </p>

                {expiresAt && (
                  <p className="mt-0.5 text-xs text-emerald-700/70">
                    Válido até{' '}
                    {formatDateTime(
                      expiresAt,
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="break-all text-xs leading-5 text-gray-500">
              {url}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg bg-[#006571] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#00535d]"
            >
              {copied
                ? 'Copiado ✓'
                : 'Copiar link'}
            </button>

            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Abrir portal
            </a>

            <button
              type="button"
              disabled={isPending}
              onClick={revokePortal}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending
                ? 'A processar...'
                : 'Revogar portal'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

