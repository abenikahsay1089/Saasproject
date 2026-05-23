import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Draggable task card: grip uses sortable listeners; main area opens the task modal.
 */
export default function TaskCard({ task, onOpen, readOnly = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
    data: { type: 'task', task },
    disabled: readOnly,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800',
        isDragging ? 'opacity-60 ring-2 ring-indigo-400' : '',
      ].join(' ')}
    >
      {!readOnly && (
        <button
          type="button"
          className="mt-0.5 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Drag task"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      )}
      <button
        type="button"
        onClick={() => onOpen?.(task)}
        className="min-w-0 flex-1 rounded-md px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
      >
        <p className="font-medium text-slate-900 dark:text-white">{task.title}</p>
        {task.assignee_name && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">@{task.assignee_name}</p>
        )}
        {task.priority && (
          <span className="mt-2 inline-block rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-500">
            {task.priority}
          </span>
        )}
      </button>
    </div>
  );
}
