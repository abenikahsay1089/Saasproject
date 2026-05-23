import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard.jsx';
import CreateTaskForm from './CreateTaskForm.jsx';

/**
 * One list column: droppable area + vertical sortable task stack + quick-add form.
 */
export default function KanbanColumn({ list, tasks, onOpenTask, readOnly = false }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${list.id}` });
  const ids = tasks.map((t) => String(t.id));

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {list.title}
          </h2>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {tasks.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={[
          'flex min-h-[120px] flex-1 flex-col gap-2 p-2',
          isOver ? 'bg-indigo-50/80 dark:bg-indigo-950/40' : '',
        ].join(' ')}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={onOpenTask} readOnly={readOnly} />
          ))}
        </SortableContext>
      </div>
      {!readOnly && (
        <div className="border-t border-slate-200 p-2 dark:border-slate-800">
          <CreateTaskForm listId={list.id} />
        </div>
      )}
    </div>
  );
}
