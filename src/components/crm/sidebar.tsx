'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navigation = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: DashboardIcon,
  },
  {
    label: 'Clientes',
    href: '/clientes',
    icon: UsersIcon,
  },
  {
    label: 'Processos',
    href: '/processos',
    icon: FolderIcon,
  },
  {
    label: 'Bancos',
    href: '/bancos',
    icon: BankIcon,
  },
  {
    label: 'Fornecedores',
    href: '/fornecedores',
    icon: StoreIcon,
  },
  {
    label: 'Documentos',
    href: '/documentos',
    icon: DocumentIcon,
  },
  {
    label: 'Tarefas',
    href: '/tarefas',
    icon: TasksIcon,
  },
  {
    label: 'Prazos',
    href: '/prazos',
    icon: ClockIcon,
  },
];

const bottomNavigation = [
  {
    label: 'Administração',
    href: '/administracao',
    icon: SettingsIcon,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] =
    useState(false);

  function isActive(href: string) {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  return (
    <>
      {/* MOBILE TOP BUTTON */}

      <button
        type="button"
        onClick={() =>
          setMobileOpen(true)
        }
        className="fixed left-4 top-3.5 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm lg:hidden"
        aria-label="Abrir menu"
      >
        <MenuIcon />
      </button>

      {/* MOBILE OVERLAY */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-gray-200/80 bg-white transition-transform duration-200',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* LOGO */}

        <div className="flex h-[72px] items-center justify-between border-b border-gray-100 px-6">
          <Link
            href="/dashboard"
            onClick={() =>
              setMobileOpen(false)
            }
            className="flex items-center"
          >
            <Image
              src="/images/logocrediauto.png"
              alt="CrediAuto"
              width={145}
              height={44}
              priority
              className="h-auto w-[140px] object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={() =>
              setMobileOpen(false)
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 lg:hidden"
            aria-label="Fechar menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* NAVIGATION */}

        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
            Gestão
          </p>

          <nav className="space-y-1">
            {navigation.map(
              (item) => {
                const active =
                  isActive(
                    item.href,
                  );

                const Icon =
                  item.icon;

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    onClick={() =>
                      setMobileOpen(
                        false,
                      )
                    }
                    className={[
                      'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                      active
                        ? 'bg-[#EAF5F6] text-[#006571]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950',
                    ].join(
                      ' ',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 h-5 w-[3px] rounded-r-full bg-[#006571]" />
                    )}

                    <span
                      className={[
                        'flex h-5 w-5 shrink-0 items-center justify-center transition',
                        active
                          ? 'text-[#006571]'
                          : 'text-gray-400 group-hover:text-gray-600',
                      ].join(
                        ' ',
                      )}
                    >
                      <Icon />
                    </span>

                    <span>
                      {
                        item.label
                      }
                    </span>
                  </Link>
                );
              },
            )}
          </nav>

          <div className="mt-auto pt-8">
            <div className="mb-3 border-t border-gray-100" />

            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              Sistema
            </p>

            <nav className="space-y-1">
              {bottomNavigation.map(
                (item) => {
                  const active =
                    isActive(
                      item.href,
                    );

                  const Icon =
                    item.icon;

                  return (
                    <Link
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      onClick={() =>
                        setMobileOpen(
                          false,
                        )
                      }
                      className={[
                        'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                        active
                          ? 'bg-[#EAF5F6] text-[#006571]'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950',
                      ].join(
                        ' ',
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 h-5 w-[3px] rounded-r-full bg-[#006571]" />
                      )}

                      <span
                        className={[
                          'flex h-5 w-5 shrink-0 items-center justify-center',
                          active
                            ? 'text-[#006571]'
                            : 'text-gray-400 group-hover:text-gray-600',
                        ].join(
                          ' ',
                        )}
                      >
                        <Icon />
                      </span>

                      {
                        item.label
                      }
                    </Link>
                  );
                },
              )}
            </nav>
          </div>
        </div>

        {/* BRAND FOOTER */}

        <div className="border-t border-gray-100 px-6 py-4">
          <p className="text-[11px] leading-5 text-gray-400">
            Miranda & Cunha Lda.
          </p>

          <p className="text-[10px] text-gray-300">
            CrediAuto CRM
          </p>
        </div>
      </aside>
    </>
  );
}

/* ================================
   ICONS
================================ */

function DashboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="14"
        y="4"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="14"
        y="14"
        width="6"
        height="6"
        rx="1"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M17 14a5 5 0 0 1 3.5 5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-11Z" />
    </svg>
  );
}

function BankIcon() {
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
      <path d="M3.5 9 12 4l8.5 5" />
      <path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9" />
      <path d="M3.5 19.5h17" />
    </svg>
  );
}

function StoreIcon() {
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
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5 11.5V20h14v-8.5" />
      <path d="M10 20v-4.5h4V20" />
    </svg>
  );
}

function DocumentIcon() {
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
      <path d="M6 3.5h8l4 4V20H6V3.5Z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 12h6M9 15.5h6" />
    </svg>
  );
}

function TasksIcon() {
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
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
      />
      <path d="m8 10 1.5 1.5L12 9" />
      <path d="M14 10h3" />
      <path d="M8 15h9" />
    </svg>
  );
}

function ClockIcon() {
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
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <circle
        cx="12"
        cy="12"
        r="3"
      />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1A8 8 0 0 0 14.4 5L14 2.5h-4L9.6 5a8 8 0 0 0-2.1 1.9l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 9.6 19l.4 2.5h4l.4-2.5a8 8 0 0 0 2.1-1.9l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}