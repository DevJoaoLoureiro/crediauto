'use client';

import {
  useState,
  useTransition,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  startRgpdFromPortalAction,
} from '@/app/documentos-cliente/[token]/actions';

type Props = {
  portalToken: string;
  /** Pedido RGPD do interveniente que vai assinar. */
  requestId: string;
};

export default function StartRgpdButton({
  portalToken,
  requestId,
}: Props) {
  const router = useRouter();

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

  function handleClick() {
    setError(null);

    startTransition(
      async () => {
        const result =
          await startRgpdFromPortalAction(
            portalToken,
            requestId,
          );

        if (!result.success) {
          setError(
            result.message,
          );

          return;
        }

        /*
         * Criamos o URL corretamente e
         * garantimos que "portal" existe
         * apenas UMA vez.
         */
        const target =
          new URL(
            result.url,
            window.location.origin,
          );

        target.searchParams.set(
          'portal',
          portalToken,
        );

        router.push(
          `${target.pathname}${target.search}`,
        );
      },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00535d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? 'A preparar...'
          : 'Preencher e assinar'}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}