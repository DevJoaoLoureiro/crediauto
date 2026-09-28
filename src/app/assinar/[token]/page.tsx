import { notFound } from 'next/navigation';

import RgpdSigningEditor from '@/components/pdf-editor/rgpd-signing-editor';

import { createAdminClient } from '@/lib/supabase/admin';

import {
  hashSignatureToken,
} from '@/lib/signatures/token';
import { isExpired } from '@/lib/format';

type SignPageProps = {
  params: Promise<{
    token: string;
  }>;

  searchParams: Promise<{
    portal?: string | string[];
  }>;
};

export default async function SignPage({
  params,
  searchParams,
}: SignPageProps) {
  const { token } = await params;

  if (!token || token.length > 200) {
    notFound();
  }

  const search =
    await searchParams;

  const portal =
    Array.isArray(search.portal)
      ? search.portal[0]
      : search.portal;

  const tokenHash =
    hashSignatureToken(token);

  const supabase =
    createAdminClient();

  const {
    data: signatureToken,
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
    .maybeSingle();

  if (!signatureToken) {
    notFound();
  }

  if (
    signatureToken.revoked_at ||
    signatureToken.used_at
  ) {
    return (
      <InvalidLink
        message="Este link já não está disponível."
      />
    );
  }

  if (isExpired(signatureToken.expires_at)) {
    return (
      <InvalidLink
        message="Este link expirou. Solicite um novo link à CrediAuto."
      />
    );
  }

  /*
   * Documento + cliente numa só consulta.
   */
  const { data: document } =
    await supabase
      .from('documents')
      .select(`
        id,
        process_id,
        client_id,
        clients (
          id,
          full_name,
          nif,
          identification_number
        )
      `)
      .eq(
        'id',
        signatureToken.document_id,
      )
      .maybeSingle();

  const client = Array.isArray(
    document?.clients,
  )
    ? document.clients[0] ?? null
    : document?.clients ?? null;

  if (!document || !client) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f4f7f8]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <p className="text-sm font-semibold text-[#006571]">
            CrediAuto
          </p>

          <h1 className="mt-1 text-xl font-semibold text-gray-950">
            Autorização RGPD
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {client.full_name}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-5 rounded-xl border border-[#1693A0]/20 bg-[#1693A0]/5 p-4 text-sm text-gray-600">
          Reveja os seus dados, selecione as autorizações
          pretendidas e assine o documento no final.
        </div>

       <RgpdSigningEditor
            token={token}
            portalToken={
                portal ?? null
            }
            />
        {/*
          O botão de submissão será ligado
          ao estado interno do editor no
          próximo passo.
        */}
      </div>
    </main>
  );
}

function InvalidLink({
  message,
}: {
  message: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f8] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          !
        </div>

        <h1 className="mt-5 text-xl font-semibold text-gray-950">
          Link indisponível
        </h1>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {message}
        </p>

        <p className="mt-6 text-xs text-gray-400">
          CrediAuto · Miranda & Cunha Lda
        </p>
      </div>
    </main>
  );
}