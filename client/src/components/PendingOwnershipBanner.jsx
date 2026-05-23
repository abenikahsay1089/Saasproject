import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ownershipTransfersApi } from '../services/api.js';
import { board as boardCopy } from '../content/copy.js';

export default function PendingOwnershipBanner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['pending-ownership-transfers'],
    queryFn: () => ownershipTransfersApi.pending(),
    refetchOnMount: 'always',
  });

  const acceptMutation = useMutation({
    mutationFn: (id) => ownershipTransfersApi.accept(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pending-ownership-transfers'] });
      qc.invalidateQueries({ queryKey: ['boards'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      if (res.boardId) navigate(`/boards/${res.boardId}`);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id) => ownershipTransfersApi.decline(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-ownership-transfers'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const transfers = data?.transfers || [];
  if (!transfers.length) return null;

  const busy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 dark:border-amber-600 dark:bg-amber-950/40">
      <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">
        Ownership transfer requests ({transfers.length})
      </h2>
      <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
        Accept to become the workspace owner, or decline to keep the current owner.
      </p>
      <ul className="mt-4 space-y-3">
        {transfers.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-slate-900"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{t.board_title}</p>
              <p className="text-sm text-slate-500">
                From {t.from_name || 'current owner'} ·{' '}
                {new Date(t.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(boardCopy.transferOwnershipAcceptConfirm)) acceptMutation.mutate(t.id);
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {boardCopy.inviteAccept}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(boardCopy.transferOwnershipDeclineConfirm)) declineMutation.mutate(t.id);
                }}
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
