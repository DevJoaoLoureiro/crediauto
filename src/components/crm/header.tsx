'use client';

import { usePathname } from 'next/navigation';

const pageNames: Record<string, string> = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  processos: 'Processos',
  documentos: 'Documentos',
  tarefas: 'Tarefas',
  administracao: 'Administração',
};

type HeaderProps = {
  fullName: string;
  role: string;
};

export default function Header({
  fullName,
  role,
}: HeaderProps) {
  const pathname = usePathname();

  const firstSegment =
    pathname
      .split('/')
      .filter(Boolean)[0] ??
    'dashboard';

  const section =
    pageNames[firstSegment] ??
    'CrediAuto';

  const initials =
    getInitials(fullName);

  const roleLabel =
    role === 'admin'
      ? 'Administrador'
      : 'Gestor';

  return (
    <header className="sticky top-0 z-30 h-[72px] border-b border-gray-200/70 bg-white/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-4 px-4 pl-[68px] sm:px-6 sm:pl-[72px] lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-gray-400 sm:inline">
              CrediAuto
            </span>

            <span className="hidden text-gray-300 sm:inline">
              /
            </span>

            <span className="truncate font-medium text-gray-700">
              {section}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* FUTURA PESQUISA GLOBAL */}

          <button
            type="button"
            title="Pesquisa global — em breve"
            className="hidden h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-400 transition hover:bg-gray-50 sm:flex"
          >
            <SearchIcon />

            <span className="hidden xl:inline">
              Pesquisar...
            </span>
          </button>

          {/* NOTIFICAÇÕES */}

          <button
            type="button"
            title="Notificações — em breve"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <BellIcon />
          </button>

          <div className="mx-1 hidden h-7 w-px bg-gray-200 sm:block" />

          {/* USER */}

          <button
            type="button"
            className="flex items-center gap-3 rounded-xl p-1.5 pr-2 transition hover:bg-gray-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#006571] text-xs font-bold text-white">
              {initials}
            </div>

            <div className="hidden text-left md:block">
              <p className="max-w-[140px] truncate text-sm font-semibold text-gray-800">
                {fullName}
              </p>

              <p className="text-[11px] text-gray-400">
                {roleLabel}
              </p>
            </div>

            <ChevronIcon />
          </button>
        </div>
      </div>
    </header>
  );
}

function getInitials(
  fullName: string,
) {
  const parts =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return 'U';
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    `${parts[0][0] ?? ''}${
      parts[
        parts.length - 1
      ][0] ?? ''
    }`
      .toUpperCase()
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-[18px] w-[18px]"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="5.5"
      />
      <path d="m15 15 4 4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" />
      <path d="M10 20h4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="hidden h-4 w-4 text-gray-400 sm:block"
    >
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}