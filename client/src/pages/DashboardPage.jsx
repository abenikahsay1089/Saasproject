import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import BoardCard from '../components/BoardCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PendingInvitesBanner from '../components/PendingInvitesBanner.jsx';
import PendingOwnershipBanner from '../components/PendingOwnershipBanner.jsx';
import { dashboard } from '../content/copy.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['boards'],
    queryFn: () => boardsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (boardTitle) => boardsApi.create(boardTitle),
    onSuccess: () => {
      setTitle('');
      qc.invalidateQueries({ queryKey: ['boards'] });
    },
  });

  const boards = data?.boards || [];
  const firstName = user?.name?.split(' ')[0] || 'there';

  function createBoard(name) {
    const t = (name || title).trim();
    if (!t) return;
    createMutation.mutate(t);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        subtitle={dashboard.subtitle}
        badge={
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {boards.length} {boards.length === 1 ? 'board' : 'boards'}
          </span>
        }
      />

      <PendingInvitesBanner />
      <PendingOwnershipBanner />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          New workspace
        </h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createBoard();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={dashboard.createPlaceholder}
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !title.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {dashboard.createCta}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="w-full text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick start templates
          </span>
          {dashboard.templates.map((t) => (
            <button
              key={t.title}
              type="button"
              title={t.hint}
              onClick={() => createBoard(t.title)}
              disabled={createMutation.isPending}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
            >
              <span className="font-medium text-slate-800 dark:text-slate-200">{t.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{dashboard.title}</h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <EmptyState
            icon="📋"
            title={dashboard.emptyTitle}
            description={dashboard.emptyBody}
            action={
              <button
                type="button"
                onClick={() => createBoard('My first board')}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create “My first board”
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <BoardCard key={b.id} board={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
