import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  /*
   * getClaims valida o JWT localmente (chaves assimétricas),
   * evitando uma chamada ao servidor Auth em cada pedido.
   * Também renova a sessão quando necessário.
   */
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims ?? null;

  const pathname = request.nextUrl.pathname;

  /*
   * Rotas públicas: login, assinatura RGPD e portal do cliente.
   * As rotas /api/ tratam a sua própria autenticação (401/403)
   * em vez de redirecionarem para o login.
   */
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/assinar/') ||
    pathname.startsWith('/documentos-cliente/') ||
    pathname.startsWith('/api/');

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();

    url.pathname = '/';

    return NextResponse.redirect(url);
  }

  if (user && pathname === '/') {
    const url = request.nextUrl.clone();

    url.pathname = '/dashboard';

    return NextResponse.redirect(url);
  }

  return response;
}