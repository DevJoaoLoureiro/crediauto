import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(
  request: NextRequest,
) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Ignora ficheiros estáticos (incluindo o PDF RGPD em
     * public/documents, que o cliente abre sem sessão).
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)',
  ],
};