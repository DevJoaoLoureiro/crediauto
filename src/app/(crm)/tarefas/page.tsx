import Link from 'next/link';

import TaskToggle from '@/components/tarefas/task-toggle';
import { createClient } from '@/lib/supabase/server';
import { formatDate, todayIsoDate } from '@/lib/format';

type TasksPageProps = {
  searchParams: Promise<{
    estado?: string;
    minhas?: string;
  }>;
};

const TASK_KIND_LABELS: Record<string, string> = {
  counter_proposal: 'Contraproposta',
  manual: 'Manual',
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;
  const showDone = params.estado === 'concluidas';
  const onlyMine = params.minhas === '1';

  const supabase = await createClient();
  const today = todayIsoDate();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const countTasks = () =>
    supabase
      .from('process_tasks')
      .select('id', { count: 'exact', head: true });

  let listQuery = supabase
    .from('process_tasks')
    .select(`
      id,
      title,
      description,
      kind,
      due_date,
      done_at,
      assignee:profiles!assigned_to (
        id,
        full_name
      ),
      process:credit_processes (
        id,
        reference,
        clients!client_id (
          full_name
        )
      )
    `)
    .limit(300);

  listQuery = showDone
    ? listQuery
        .not('done_at', 'is', null)
        .order('done_at', { ascending: false })
    : listQuery
        .is('done_at', null)
        .order('due_date', { ascending: true, nullsFirst: false });

  if (onlyMine && user) {
    listQuery = listQuery.eq('assigned_to', user.id);
  }

  const [
    todayResult,
    overdueResult,
    openResult,
    doneResult,
    listResult,
  ] = await Promise.all([
    countTasks().is('done_at', null).eq('due_date', today),
    countTasks().is('done_at', null).lt('due_date', today),
    countTasks().is('done_at', null),
    countTasks().not('done_at', 'is', null),
    listQuery,
  ]);

  if (listResult.error) {
    console.error('Erro ao carregar tarefas:', listResult.error);
  }

  const tasks = (listResult.data ?? []).map((task) => {
    const process = Array.isArray(task.process)
      ? task.process[0]
      : task.process;

    const client = Array.isArray(process?.clients)
      ? process.clients[0]
      : process?.clients;

    return {
      ...task,
      assignee: Array.isArray(task.assignee)
        ? task.assignee[0]
        : task.assignee,
      process,
      clientName: client?.full_name ?? null,
    };
  });

  const filterHref = (next: { estado?: string; minhas?: string }) => {
    const search = new URLSearchParams();
    const estado = next.estado ?? params.estado;
    const minhas = next.minhas ?? params.minhas;

    if (estado === 'concluidas') search.set('estado', estado);
    if (minhas === '1') search.set('minhas', '1');

    const query = search.toString();
    return query ? `/tarefas?${query}` : '/tarefas';
  };

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-[#006571]">Organização</p>

        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#172126]">
          Tarefas
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
          Seguimentos e lembretes dos processos. As tarefas criam-se dentro de cada processo.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TaskMetric
          label="Para hoje"
          value={todayResult.count ?? 0}
          description="Tarefas com prazo hoje"
          tone="warning"
        />

        <TaskMetric
          label="Em atraso"
          value={overdueResult.count ?? 0}
          description="Prazo ultrapassado"
          tone="danger"
        />

        <TaskMetric
          label="Pendentes"
          value={openResult.count ?? 0}
          description="Ainda por concluir"
          tone="info"
        />

        <TaskMetric
          label="Concluídas"
          value={doneResult.count ?? 0}
          description="Trabalho finalizado"
          tone="success"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#172126]">
              {showDone ? 'Tarefas concluídas' : 'Tarefas pendentes'}
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
              {onlyMine ? ' atribuídas a mim' : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterLink
              href={filterHref({ estado: 'pendentes' })}
              active={!showDone}
              label="Pendentes"
            />
            <FilterLink
              href={filterHref({ estado: 'concluidas' })}
              active={showDone}
              label="Concluídas"
            />
            <FilterLink
              href={filterHref({ minhas: onlyMine ? '0' : '1' })}
              active={onlyMine}
              label="Só as minhas"
            />
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-700">
              {showDone ? 'Sem tarefas concluídas' : 'Nada pendente'}
            </p>

            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-gray-400">
              As tarefas e lembretes dos processos aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tasks.map((task) => {
              const overdue =
                !task.done_at && task.due_date !== null && task.due_date < today;

              return (
                <li
                  key={task.id}
                  className="flex items-start gap-4 px-6 py-4"
                >
                  <div className="pt-0.5">
                    <TaskToggle
                      taskId={task.id}
                      done={Boolean(task.done_at)}
                      title={task.title}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={
                          task.done_at
                            ? 'text-sm text-gray-400 line-through'
                            : 'text-sm font-semibold text-gray-900'
                        }
                      >
                        {task.title}
                      </p>

                      {task.kind !== 'manual' && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                          {TASK_KIND_LABELS[task.kind] ?? task.kind}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {task.description}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-gray-400">
                      {task.process && (
                        <Link
                          href={`/processos/${task.process.id}`}
                          className="font-medium text-[#006571] hover:underline"
                        >
                          {task.process.reference ?? 'Processo'}
                        </Link>
                      )}
                      {task.clientName && ` · ${task.clientName}`}
                      {task.assignee && ` · ${task.assignee.full_name}`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right text-xs">
                    {task.done_at ? (
                      <span className="text-gray-400">
                        Concluída {formatDate(task.done_at)}
                      </span>
                    ) : task.due_date ? (
                      <span
                        className={
                          overdue
                            ? 'font-semibold text-red-600'
                            : task.due_date === today
                              ? 'font-semibold text-amber-700'
                              : 'text-gray-500'
                        }
                      >
                        {overdue ? 'Em atraso · ' : 'Até '}
                        {formatDate(task.due_date)}
                      </span>
                    ) : (
                      <span className="text-gray-300">Sem prazo</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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

      <p className="mt-1 text-sm font-semibold text-gray-700">{label}</p>

      <p className="mt-1 text-xs leading-5 text-gray-400">{description}</p>
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        'rounded-lg px-3 py-2 text-xs font-semibold transition',
        active
          ? 'bg-[#EAF5F6] text-[#006571]'
          : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
      ].join(' ')}
    >
      {label}
    </Link>
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
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8 10 1.5 1.5L12 9" />
      <path d="M14 10h3" />
      <path d="M8 15h9" />
    </svg>
  );
}
