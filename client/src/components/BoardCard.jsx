import { Link } from 'react-router-dom';
import { board as boardCopy } from '../content/copy.js';

/**
 * Dashboard workspace card — links into the Kanban board view.
 */
export default function BoardCard({ board }) {
  const frozen = board.status === 'frozen';
  const created = new Date(board.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link
      to={`/boards/${board.id}`}
      className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-lg text-white shadow-sm">
        📌
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
          {board.title}
        </h3>
        {frozen && (
          <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            {boardCopy.frozenBadge}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Created {created}</p>
      <p className="mt-4 text-sm font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100 dark:text-indigo-400">
        Open board →
      </p>
    </Link>
  );
}
