import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { invitesApi, notificationsApi, ownershipTransfersApi } from '../services/api.js';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PendingInvitesBanner from '../components/PendingInvitesBanner.jsx';
import PendingOwnershipBanner from '../components/PendingOwnershipBanner.jsx';
import { NotificationActions } from '../components/NotificationActions.jsx';
import { board as boardCopy, notifications as copy, notificationTypeLabels } from '../content/copy.js';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [actionError, setActionError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });
  const { data: pendingData } = useQuery({
    queryKey: ['pending-invites'],
    queryFn: () => invitesApi.pending(),
  });
  const { data: pendingOwnershipData } = useQuery({
    queryKey: ['pending-ownership-transfers'],
    queryFn: () => ownershipTransfersApi.pending(),
  });

  const readMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  async function markAllRead() {
    const unread = items.filter((n) => !n.read_status);
    await Promise.all(unread.map((n) => notificationsApi.markRead(n.id)));
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  const acceptMutation = useMutation({
    mutationFn: (inviteId) => invitesApi.accept(inviteId),
    onSuccess: (res) => {
      setActionError('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['boards'] });
      if (res.boardId) navigate(`/boards/${res.boardId}`);
    },
    onError: (e) => setActionError(e.message),
  });

  const declineMutation = useMutation({
    mutationFn: (inviteId) => invitesApi.decline(inviteId),
    onSuccess: () => {
      setActionError('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => setActionError(e.message),
  });

  const acceptOwnershipMutation = useMutation({
    mutationFn: (transferId) => ownershipTransfersApi.accept(transferId),
    onSuccess: (res) => {
      setActionError('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['pending-ownership-transfers'] });
      qc.invalidateQueries({ queryKey: ['boards'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      if (res.boardId) navigate(`/boards/${res.boardId}`);
    },
    onError: (e) => setActionError(e.message),
  });

  const declineOwnershipMutation = useMutation({
    mutationFn: (transferId) => ownershipTransfersApi.decline(transferId),
    onSuccess: () => {
      setActionError('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['pending-ownership-transfers'] });
    },
    onError: (e) => setActionError(e.message),
  });

  const items = data?.notifications || [];
  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.read_status);
    return items;
  }, [items, filter]);
  const unreadCount = items.filter((n) => !n.read_status).length;
  const actionBusy =
    acceptMutation.isPending ||
    declineMutation.isPending ||
    acceptOwnershipMutation.isPending ||
    declineOwnershipMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={copy.title}
        subtitle={`${copy.subtitle} ${boardCopy.inviteInboxHint}`}
        badge={
          unreadCount > 0 ? (
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {unreadCount} unread
            </span>
          ) : null
        }
      />

      <PendingInvitesBanner />
      <PendingOwnershipBanner />

      {(pendingData?.invites?.length ?? 0) > 0 && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100">
          You have {pendingData.invites.length} workspace invite(s). Accept them on{' '}
          <Link to="/" className="font-semibold underline">
            Workspaces
          </Link>{' '}
          or below.
        </p>
      )}

      {actionError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              filter === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {copy.markAllRead}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔔" title={copy.emptyTitle} description={copy.emptyBody} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const pendingMatch = pendingData?.invites?.find((inv) =>
              n.message?.includes(inv.board_title)
            );
            const inviteId = n.board_invite_id || pendingMatch?.id;
            const isWorkspaceInvite = n.type === 'board_invite' && inviteId && !n.read_status;
            const ownershipMatch = pendingOwnershipData?.transfers?.find((t) =>
              n.message?.includes(t.board_title)
            );
            const transferId = n.ownership_transfer_id || ownershipMatch?.id;
            const isOwnershipTransfer =
              n.type === 'ownership_transfer' && transferId && !n.read_status;
            return (
              <li
                key={n.id}
                className={[
                  'rounded-xl border px-4 py-3 transition',
                  n.read_status
                    ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    : 'border-indigo-200 bg-indigo-50/80 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/40',
                ].join(' ')}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      {n.message}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {n.type && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {notificationTypeLabels[n.type] || n.type.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {isWorkspaceInvite ? (
                      <>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => acceptMutation.mutate(inviteId)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {boardCopy.inviteAccept}
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => declineMutation.mutate(inviteId)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                          {boardCopy.inviteDecline}
                        </button>
                      </>
                    ) : isOwnershipTransfer ? (
                      <>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => {
                            if (confirm(boardCopy.transferOwnershipAcceptConfirm)) {
                              acceptOwnershipMutation.mutate(transferId);
                            }
                          }}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {boardCopy.inviteAccept}
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => {
                            if (confirm(boardCopy.transferOwnershipDeclineConfirm)) {
                              declineOwnershipMutation.mutate(transferId);
                            }
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                          {boardCopy.inviteDecline}
                        </button>
                      </>
                    ) : (
                      <NotificationActions
                        notification={n}
                        copy={copy}
                        onMarkRead={(id) => readMutation.mutate(id)}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
