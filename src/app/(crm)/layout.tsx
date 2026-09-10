import type { ReactNode } from 'react';

import Sidebar from '@/components/crm/sidebar';
import Header from '@/components/crm/header';

export default function CrmLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F6F8F9]">
      <Sidebar />

      <div className="min-h-screen lg:pl-[260px]">
        <Header />

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}