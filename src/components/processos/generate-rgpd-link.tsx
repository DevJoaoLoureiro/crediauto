'use client';

import { useState } from 'react';

import { generateRgpdLinkAction } from '@/app/(crm)/processos/[id]/rgpd-actions';

type GenerateRgpdLinkProps = {
  processId: string;
};

export default function GenerateRgpdLink({
  processId,
}: GenerateRgpdLinkProps) {
  const [loading, setLoading] =
    useState(false);

  const [url, setUrl] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setCopied(false);

    const result =
      await generateRgpdLinkAction(
        processId,
      );

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setUrl(result.url);
  }

  async function copy() {
    if (!url) return;

    await navigator.clipboard.writeText(
      url,
    );

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  if (!url) {
    return (
      <div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="w-full rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00535d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? 'A gerar...'
            : 'Gerar link RGPD'}
        </button>

        {error && (
          <p className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#1693A0]/20 bg-[#1693A0]/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#006571]">
          Link para o cliente
        </p>

        <p className="mt-2 break-all text-sm text-gray-600">
          {url}
        </p>
      </div>

      <button
        type="button"
        onClick={copy}
        className="w-full rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00535d]"
      >
        {copied
          ? 'Link copiado ✓'
          : 'Copiar link'}
      </button>
    </div>
  );
}