'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { logProcessEvent } from '@/lib/crm/events';

type ActionResult =
  | { success: true }
  | { success: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* =========================================================
   NOVA TAREFA NUM PROCESSO
========================================================= */

export async function createTaskAction(
  processId: string,
  input: {
    title: string;
    description: string;
    dueDate: string;
    assignedTo: string;
  },
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  const title = input.title.trim();

  if (!title) {
    return { success: false, message: 'Indica o título da tarefa.' };
  }

  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { success: false, message: 'Data inválida.' };
  }

  const { error } = await supabase.from('process_tasks').insert({
    process_id: processId,
    title,
    description: input.description.trim() || null,
    due_date: input.dueDate || null,
    assigned_to: UUID_PATTERN.test(input.assignedTo)
      ? input.assignedTo
      : null,
    created_by: user.id,
  });

  if (error) {
    console.error('Erro ao criar tarefa:', error);

    return {
      success: false,
      message: 'Não foi possível criar a tarefa.',
    };
  }

  revalidatePath(`/processos/${processId}`);
  revalidatePath('/tarefas');

  return { success: true };
}

/* =========================================================
   CONCLUIR / REABRIR TAREFA
========================================================= */

export async function setTaskDoneAction(
  taskId: string,
  done: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sessão inválida.' };
  }

  const { data: task, error } = await supabase
    .from('process_tasks')
    .update({
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? user.id : null,
    })
    .eq('id', taskId)
    .select('id, process_id, title, kind')
    .maybeSingle();

  if (error || !task) {
    console.error('Erro ao atualizar tarefa:', error);

    return {
      success: false,
      message: 'Não foi possível atualizar a tarefa.',
    };
  }

  if (done) {
    await logProcessEvent(supabase, {
      processId: task.process_id,
      type: 'task_completed',
      data: { task_id: task.id, title: task.title, kind: task.kind },
      createdBy: user.id,
    });
  }

  revalidatePath(`/processos/${task.process_id}`);
  revalidatePath('/tarefas');

  return { success: true };
}
