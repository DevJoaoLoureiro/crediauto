'use client';

import { useTransition } from 'react';

import { setTaskDoneAction } from '@/app/(crm)/tarefas/actions';

export default function TaskToggle({
  taskId,
  done,
  title,
}: {
  taskId: string;
  done: boolean;
  title: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={done}
      disabled={isPending}
      aria-label={done ? `Reabrir: ${title}` : `Concluir: ${title}`}
      onChange={() =>
        startTransition(async () => {
          const result = await setTaskDoneAction(taskId, !done);

          if (!result.success) {
            window.alert(result.message);
          }
        })
      }
      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#006571] disabled:opacity-50"
    />
  );
}
