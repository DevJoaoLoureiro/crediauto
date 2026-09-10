import Image from 'next/image';
import { redirect } from 'next/navigation';

import { login } from './actions';
import { createClient } from '@/lib/supabase/server';

type HomePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function HomePage({
  searchParams,
}: HomePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  const params = await searchParams;

  const errorMessage =
    params.error === 'missing'
      ? 'Preenche o email e a password.'
      : params.error === 'invalid'
        ? 'Email ou password incorretos.'
        : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f8f9]">
      {/* Decoração */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#22A9B6]/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 h-[450px] w-[450px] rounded-full bg-[#006571]/10 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* LADO ESQUERDO */}
        <section className="hidden flex-col justify-between bg-[#006571] p-12 text-white lg:flex">
          <div>
            <Image
              src="/images/logocrediauto.png"
              alt="CrediAuto"
              width={220}
              height={220}
              className="rounded-2xl bg-white p-3"
              priority
            />
          </div>

          <div className="max-w-lg">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-white/60">
              Gestão de crédito automóvel
            </p>

            <h1 className="text-4xl font-semibold leading-tight">
              Um CRM preparado para gerir clientes, processos e financiamento.
            </h1>

            <p className="mt-6 text-base leading-7 text-white/70">
              Centralização de documentação, estados de processo, financeiras,
              tarefas e assinaturas digitais.
            </p>
          </div>

          <p className="text-sm text-white/40">
            Miranda &amp; Cunha Lda
          </p>
        </section>

        {/* LOGIN */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Image
                src="/images/logocrediauto.png"
                alt="CrediAuto"
                width={170}
                height={170}
                className="mx-auto"
                priority
              />
            </div>

            <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-9">
              <div className="mb-8">
                <div className="mb-4 inline-flex rounded-full bg-[#006571]/10 px-3 py-1 text-xs font-semibold text-[#006571]">
                  Área reservada
                </div>

                <h2 className="text-3xl font-semibold tracking-tight text-[#343434]">
                  Bem-vindo
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Entre na sua conta para aceder ao CrediAuto CRM.
                </p>
              </div>

              <form action={login} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="nome@empresa.pt"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      bg-gray-50
                      px-4
                      py-3
                      text-sm
                      text-gray-900
                      outline-none
                      transition
                      placeholder:text-gray-400
                      focus:border-[#1693A0]
                      focus:bg-white
                      focus:ring-4
                      focus:ring-[#1693A0]/10
                    "
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      bg-gray-50
                      px-4
                      py-3
                      text-sm
                      text-gray-900
                      outline-none
                      transition
                      placeholder:text-gray-400
                      focus:border-[#1693A0]
                      focus:bg-white
                      focus:ring-4
                      focus:ring-[#1693A0]/10
                    "
                  />
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  className="
                    w-full
                    rounded-xl
                    bg-[#006571]
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-[#00535d]
                    focus:outline-none
                    focus:ring-4
                    focus:ring-[#006571]/20
                  "
                >
                  Entrar no CrediAuto
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              CrediAuto · Soluções e Negócios
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}