'use client';

import { useState, useTransition } from 'react';

import {
  createTaskAction,
  setTaskDoneAction,
} from '@/app/(crm)/tarefas/actions';
import { formatDate } from '@/lib/format';

export type TaskData = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  due_date: string | null;
  done_at: string | null;
  assignee: { id: string; full_name: string } | null;
};

type Props = {
  processId: string;
  tasks: TaskData[];
  team: { id: string; full_name: string }[];
  today: string;
};

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1693A0] focus:bg-white focus:ring-4 focus:ring-[#1693A0]/10';

export default function ProcessTasks({
  processId,
  tasks,
  team,
  today,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState({
    title: '',
    description: '',
    dueDate: '',
    assignedTo: '',
  });

  const openTasks = tasks.filter((task) => !task.done_at);
  const doneTasks = tasks.filter((task) => task.done_at);

  function toggle(task: TaskData) {
    setError(null);

    startTransition(async () => {
      const result = await setTaskDoneAction(task.id, !task.done_at);

      if (!result.success) {
        setError(result.message);
      }
    });
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createTaskAction(processId, values);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setValues({ title: '', description: '', dueDate: '', assignedTo: '' });
      setFormOpen(false);
    });
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-950">
          Tarefas
          {openTasks.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {openTasks.length}
            </span>
          )}
        </h2>

        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="text-sm font-medium text-[#006571] hover:underline"
          >
            + Nova
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <input
            required
            placeholder="Título *"
            aria-label="Título"
            value={values.title}
            onChange={(event) =>
              setValues({ ...values, title: event.target.value })
            }
            className={inputClassName}
          />

          <input
            placeholder="Descrição"
            aria-label="Descrição"
            value={values.description}
            onChange={(event) =>
              setValues({ ...values, description: event.target.value })
            }
            className={inputClassName}
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              aria-label="Prazo"
              value={values.dueDate}
              onChange={(event) =>
                setValues({ ...values, dueDate: event.target.value })
              }
              className={inputClassName}
            />

            <select
              aria-label="Responsável"
              value={values.assignedTo}
              onChange={(event) =>
                setValues({ ...values, assignedTo: event.target.value })
              }
              className={inputClassName}
            >
              <option value="">Responsável...</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[#006571] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#00535d] disabled:opacity-60"
            >
              Criar
            </button>
          </div>
        </form>
      )}

      <ul className="mt-4 space-y-2">
        {tasks.length === 0 && (
          <li className="text-sm text-gray-400">Sem tarefas.</li>
        )}

        {[...openTasks, ...doneTasks].map((task) => {
          const overdue =
            !task.done_at && task.due_date !== null && task.due_date < today;

          return (
            <li
              key={task.id}
              className="flex items-start gap-3 rounded-xl border border-gray-100 p-3"
            >
              <input
                type="checkbox"
                checked={Boolean(task.done_at)}
                onChange={() => toggle(task)}
                disabled={isPending}
                aria-label={`Concluir: ${task.title}`}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-[#006571]"
              />

              <div className="min-w-0">
                <p
                  className={
                    task.done_at
                      ? 'text-sm text-gray-400 line-through'
                      : 'text-sm font-medium text-gray-800'
                  }
                >
                  {task.title}
                </p>

                {task.description && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {task.description}
                  </p>
                )}

                <p className="mt-1 text-xs text-gray-400">
                  {task.due_date && (
                    <span
                      className={overdue ? 'font-semibold text-red-600' : ''}
                    >
                      {overdue ? 'Em atraso · ' : 'Até '}
                      {formatDate(task.due_date)}
                    </span>
                  )}
                  {task.due_date && task.assignee && ' · '}
                  {task.assignee?.full_name}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
