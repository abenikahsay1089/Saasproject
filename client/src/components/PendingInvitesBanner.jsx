import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { invitesApi } from '../services/api.js';
import { board as boardCopy } from '../content/copy.js';

/**
 * Shown on Workspaces when the user has board invites awaiting acceptance.
 */
export default function PendingInvitesBanner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['pending-invites'],
    queryFn: () => invitesApi.pending(),
    refetchOnMount: 'always',
  });

  const acceptMutation = useMutation({
    mutationFn: (id) => invitesApi.accept(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pending-invites'] });
      qc.invalidateQueries({ queryKey: ['boards'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (res.boardId) navigate(`/boards/${res.boardId}`);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id) => invitesApi.decline(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-invites'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const invites = data?.invites || [];
  if (!invites.length) return null;

  const busy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <section className="rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-5 dark:border-indigo-700 dark:bg-indigo-950/50">
      <h2 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
        Workspace invitations ({invites.length})
      </h2>
      <p className="mt-1 text-sm text-indigo-800/80 dark:text-indigo-200/80">
        You must accept before a board appears below. {boardCopy.inviteInboxHint}
      </p>
      <ul className="mt-4 space-y-3">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-800 dark:bg-slate-900"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{inv.board_title}</p>
              <p className="text-sm text-slate-500">
                Invited by {inv.inviter_name || 'a teammate'} ·{' '}
                {new Date(inv.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => acceptMutation.mutate(inv.id)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {boardCopy.inviteAccept}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => declineMutation.mutate(inv.id)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 disabled:opacity-50"
              >
                {boardCopy.inviteDecline}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
