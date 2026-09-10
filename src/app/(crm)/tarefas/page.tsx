import Link from 'next/link';

export default function TasksPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#006571]">
            Organização
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#172126]">
            Tarefas
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
            Organize seguimentos, pedidos de documentação e ações pendentes dos
            processos.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-xl bg-[#006571] px-4 py-2.5 text-sm font-semibold text-white opacity-50"
        >
          + Nova tarefa
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TaskMetric
          label="Para hoje"
          value={0}
          description="Tarefas com prazo hoje"
          tone="warning"
        />

        <TaskMetric
          label="Em atraso"
          value={0}
          description="Precisam de atenção"
          tone="danger"
        />

        <TaskMetric
          label="Pendentes"
          value={0}
          description="Ainda por concluir"
          tone="info"
        />

        <TaskMetric
          label="Concluídas"
          value={0}
          description="Trabalho finalizado"
          tone="success"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#172126]">
                As minhas tarefas
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                Trabalho pendente e seguimentos.
              </p>
            </div>

            <div className="flex gap-2">
              <FilterButton label="Pendentes" active />
              <FilterButton label="Concluídas" />
            </div>
          </div>

          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF5F6] text-[#006571]">
              <TasksIcon />
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-700">
              Ainda não existem tarefas
            </p>

            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-gray-400">
              Quando adicionarmos a gestão de tarefas, os seguimentos dos
              clientes e processos irão aparecer aqui.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h2 className="text-base font-semibold text-[#172126]">
              Organização diária
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-400">
              Este espaço vai funcionar como agenda operacional da equipa.
            </p>

            <div className="mt-6 space-y-3">
              <FeatureRow text="Contactar cliente" />
              <FeatureRow text="Pedir documentação" />
              <FeatureRow text="Recontactar financeira" />
              <FeatureRow text="Validar processo" />
              <FeatureRow text="Follow-up de aprovação" />
            </div>
          </section>

          <section className="rounded-2xl border border-[#1693A0]/15 bg-[#F3FAFA] p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#006571] shadow-sm">
              <CalendarIcon />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-900">
              Próximo passo
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Vamos ligar as tarefas aos clientes e processos para que cada ação
              fique associada ao respetivo processo.
            </p>

            <Link
              href="/processos"
              className="mt-4 inline-flex text-sm font-semibold text-[#006571] hover:underline"
            >
              Ver processos →
            </Link>
          </section>
        </div>
      </section>
    </div>
  );
}

function TaskMetric({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: 'warning' | 'danger' | 'info' | 'success';
}) {
  const styles = {
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-[#EAF5F6] text-[#006571]',
    success: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div
        className={[
          'flex h-9 w-9 items-center justify-center rounded-xl',
          styles[tone],
        ].join(' ')}
      >
        <TasksIcon />
      </div>

      <p className="mt-4 text-3xl font-semibold tracking-tight text-[#172126]">
        {value}
      </p>

      <p className="mt-1 text-sm font-semibold text-gray-700">
        {label}
      </p>

      <p className="mt-1 text-xs leading-5 text-gray-400">
        {description}
      </p>
    </div>
  );
}

function FilterButton({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        'rounded-lg px-3 py-2 text-xs font-semibold transition',
        active
          ? 'bg-[#EAF5F6] text-[#006571]'
          : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function FeatureRow({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFA] px-4 py-3">
      <div className="h-2 w-2 rounded-full bg-[#1693A0]" />

      <p className="text-sm text-gray-600">
        {text}
      </p>
    </div>
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

function CalendarIcon() {
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
        y="5"
        width="16"
        height="15"
        rx="2"
      />
      <path d="M8 3v4M16 3v4M4 9h16" />
    </svg>
  );
}