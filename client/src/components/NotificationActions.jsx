import { Link } from 'react-router-dom';

export function NotificationActions({ notification, copy, onMarkRead }) {
  const { board_id, conversation_id, read_status } = notification;

  if (board_id && !read_status) {
    return (
      <Link
        to={`/boards/${board_id}`}
        onClick={() => onMarkRead?.(notification.id)}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        {copy.viewBoard}
      </Link>
    );
  }

  if (conversation_id && !read_status) {
    return (
      <Link
        to={`/messages/${conversation_id}`}
        onClick={() => onMarkRead?.(notification.id)}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        {copy.viewMessages}
      </Link>
    );
  }

  if (board_id && read_status) {
    return (
      <Link
        to={`/boards/${board_id}`}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {copy.viewBoard}
      </Link>
    );
  }

  if (conversation_id && read_status) {
    return (
      <Link
        to={`/messages/${conversation_id}`}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {copy.viewMessages}
      </Link>
    );
  }

  if (!read_status && onMarkRead) {
    return (
      <button
        type="button"
        onClick={() => onMarkRead(notification.id)}
        className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950"
      >
        {copy.markRead}
      </button>
    );
  }

  return null;
}
