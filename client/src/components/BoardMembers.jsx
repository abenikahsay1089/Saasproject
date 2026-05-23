import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserAvatar from './UserAvatar.jsx';
import UserProfileModal from './UserProfileModal.jsx';
import MemberUserSearch from './MemberUserSearch.jsx';
import { board as boardCopy, people as peopleCopy } from '../content/copy.js';

const roleBadgeClass = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  member: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

/**
 * People panel: owner/admin invite, owner-only role & removal, ownership transfer.
 */
export default function BoardMembers({
  members,
  pendingInvites,
  pendingOwnershipTransfer,
  permissions,
  inviteEmail,
  onInviteEmailChange,
  onInviteSubmit,
  onInviteUser,
  inviteLoading,
  onRemoveMember,
  onCancelInvite,
  onPromoteAdmin,
  onDemoteAdmin,
  onRequestOwnershipTransfer,
  onCancelOwnershipTransfer,
  transferLoading,
  removeLoadingId,
  roleLoadingId,
  readOnly = false,
  currentUserId,
}) {
  const navigate = useNavigate();
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [profileUserId, setProfileUserId] = useState(null);

  const canInvite = permissions?.canInvite && !readOnly;
  const canManageRoles = permissions?.canManageRoles && !readOnly;
  const canRemove = permissions?.canRemoveMembers && !readOnly;
  const canCancelInvites = permissions?.canCancelInvites;
  const canTransfer = permissions?.canTransferOwnership && !readOnly;

  function closeTransferModal() {
    setTransferModalOpen(false);
    setTransferEmail('');
  }

  function handleTransferSubmit(e) {
    e.preventDefault();
    if (!transferEmail.trim() || !onRequestOwnershipTransfer) return;
    if (!confirm(boardCopy.transferOwnershipConfirm)) return;
    onRequestOwnershipTransfer(transferEmail.trim(), () => closeTransferModal());
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        People on this workspace
      </h2>

      {canInvite ? (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Invite a teammate</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{boardCopy.inviteHint}</p>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onInviteSubmit}>
            <input
              value={inviteEmail}
              onChange={(e) => onInviteEmailChange(e.target.value)}
              type="email"
              required
              disabled={inviteLoading}
              placeholder={boardCopy.invitePlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              disabled={inviteLoading}
              className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {inviteLoading ? 'Sending…' : boardCopy.inviteCta}
            </button>
          </form>
          {onInviteUser && (
            <MemberUserSearch
              members={members}
              pendingInvites={pendingInvites}
              inviteLoading={inviteLoading}
              onInviteUser={onInviteUser}
              onViewProfile={setProfileUserId}
              onMessageUser={(userId) => navigate(`/messages?with=${userId}`)}
              currentUserId={currentUserId}
            />
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{boardCopy.inviteHintMember}</p>
      )}

      {canTransfer && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={transferLoading || !!pendingOwnershipTransfer}
            onClick={() => setTransferModalOpen(true)}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {boardCopy.transferOwnership}
          </button>
          {pendingOwnershipTransfer && onCancelOwnershipTransfer && (
            <button
              type="button"
              disabled={transferLoading}
              onClick={() => {
                if (confirm(boardCopy.transferOwnershipCancelConfirm)) onCancelOwnershipTransfer();
              }}
              className="text-sm font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-400"
            >
              {boardCopy.transferOwnershipCancel}
            </button>
          )}
        </div>
      )}

      {pendingOwnershipTransfer && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {boardCopy.transferOwnershipPending}: waiting for{' '}
          <strong>{pendingOwnershipTransfer.to_name || pendingOwnershipTransfer.email}</strong> to
          accept.
        </p>
      )}

      {transferModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {boardCopy.transferOwnership}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {boardCopy.transferOwnershipHint}
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleTransferSubmit}>
              <input
                type="email"
                required
                autoFocus
                value={transferEmail}
                onChange={(e) => setTransferEmail(e.target.value)}
                placeholder={boardCopy.transferOwnershipEmailPlaceholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {transferLoading ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {members?.map((m) => {
          const isOwnerRow = m.role === 'owner';
          const isAdminRow = m.role === 'admin';
          const showRemove = canRemove && !isOwnerRow && onRemoveMember;
          const showPromote = canManageRoles && m.role === 'member' && onPromoteAdmin;
          const showDemote = canManageRoles && isAdminRow && onDemoteAdmin;

          const showMessage =
            Number(m.id) !== Number(currentUserId);

          return (
            <li
              key={`${m.id}-${m.role}`}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
            >
              <button
                type="button"
                onClick={() => setProfileUserId(m.id)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <UserAvatar user={m} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{m.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    @{m.username || m.email?.split('@')[0] || 'user'}
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span
                  className={[
                    'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                    roleBadgeClass[m.role] || roleBadgeClass.member,
                  ].join(' ')}
                >
                  {m.role}
                </span>
                {showMessage && (
                  <button
                    type="button"
                    onClick={() => navigate(`/messages?with=${m.id}`)}
                    className="rounded-md border border-indigo-200 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                  >
                    {peopleCopy.message}
                  </button>
                )}
                {showPromote && (
                  <button
                    type="button"
                    disabled={roleLoadingId === m.id}
                    onClick={() => {
                      if (confirm(boardCopy.promoteAdminConfirm)) onPromoteAdmin(m.id);
                    }}
                    className="rounded-md border border-violet-200 px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-400 disabled:opacity-50"
                  >
                    {roleLoadingId === m.id ? '…' : boardCopy.makeAdmin}
                  </button>
                )}
                {showDemote && (
                  <button
                    type="button"
                    disabled={roleLoadingId === m.id}
                    onClick={() => {
                      if (confirm(boardCopy.demoteAdminConfirm)) onDemoteAdmin(m.id);
                    }}
                    className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 disabled:opacity-50"
                  >
                    {roleLoadingId === m.id ? '…' : boardCopy.removeAdmin}
                  </button>
                )}
                {showRemove && (
                  <button
                    type="button"
                    disabled={removeLoadingId === m.id}
                    onClick={() => {
                      if (confirm(boardCopy.removeMemberConfirm)) onRemoveMember(m.id);
                    }}
                    className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 disabled:opacity-50"
                  >
                    {removeLoadingId === m.id ? '…' : boardCopy.removeMember}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {canCancelInvites && pendingInvites?.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
            Pending invites
          </p>
          <ul className="mt-2 space-y-2">
            {pendingInvites.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20"
              >
                <div className="min-w-0 text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{p.email}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    Invited {new Date(p.created_at).toLocaleDateString()} · awaiting accept
                  </span>
                </div>
                {onCancelInvite && (
                  <button
                    type="button"
                    disabled={removeLoadingId === `inv-${p.id}`}
                    onClick={() => {
                      if (confirm(boardCopy.cancelInviteConfirm)) onCancelInvite(p.id);
                    }}
                    className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {removeLoadingId === `inv-${p.id}` ? '…' : boardCopy.cancelInvite}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {profileUserId && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </section>
  );
}
