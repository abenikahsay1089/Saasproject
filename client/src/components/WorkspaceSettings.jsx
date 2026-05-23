import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardsApi } from '../services/api.js';
import { board as boardCopy } from '../content/copy.js';

export default function WorkspaceSettings({
  boardId,
  boardTitle,
  isFrozen,
  isOwner,
  onUpdated,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOwner) return null;

  async function run(action) {
    setLoading(action);
    setError('');
    setMessage('');
    try {
      let res;
      if (action === 'freeze') res = await boardsApi.freeze(boardId);
      else if (action === 'unfreeze') res = await boardsApi.unfreeze(boardId);
      else if (action === 'delete') {
        if (!confirm(boardCopy.deleteWorkspaceConfirm.replace('{title}', boardTitle))) {
          setLoading('');
          return;
        }
        await boardsApi.remove(boardId);
        navigate('/');
        return;
      }
      setMessage(res?.message || 'Done.');
      onUpdated?.();
    } catch (err) {
      setError(err.data?.error || err.message || 'Action failed');
    } finally {
      setLoading('');
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {boardCopy.workspaceSettingsTitle}
      </h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{boardCopy.workspaceSettingsHint}</p>

      {message && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {isFrozen ? (
          <button
            type="button"
            disabled={!!loading}
            onClick={() => run('unfreeze')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading === 'unfreeze' ? '…' : boardCopy.unfreezeWorkspace}
          </button>
        ) : (
          <button
            type="button"
            disabled={!!loading}
            onClick={() => {
              if (confirm(boardCopy.freezeWorkspaceConfirm.replace('{title}', boardTitle))) {
                run('freeze');
              }
            }}
            className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
          >
            {loading === 'freeze' ? '…' : boardCopy.freezeWorkspace}
          </button>
        )}
        <button
          type="button"
          disabled={!!loading}
          onClick={() => run('delete')}
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          {loading === 'delete' ? '…' : boardCopy.deleteWorkspace}
        </button>
      </div>
    </section>
  );
}
